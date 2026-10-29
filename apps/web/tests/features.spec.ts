import { test, expect, type Page } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

test.use({ actionTimeout: 15_000 });
const suffix = randomBytes(5).toString('hex');
const first = { username: 'qa_features_a_' + suffix, email: 'qa_features_a_' + suffix + '@example.com', displayName: 'QA Perfil ' + suffix };
const second = { username: 'qa_features_b_' + suffix, email: 'qa_features_b_' + suffix + '@example.com', displayName: 'QA Cuate ' + suffix };
const password = randomBytes(18).toString('hex');
const createdIds: string[] = [];
const backend = process.env.TEST_BACKEND_URL || 'http://localhost:4300/api';

async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await expect(page).toHaveURL(/\/feed/);
  await expect(page.locator('#new-post')).toBeVisible();
}

test.afterAll(async () => {
  // Elimina únicamente las dos cuentas efímeras de este archivo, incluso si un paso falló.
  const apiRequire = createRequire(path.resolve(process.cwd(), '../api/package.json'));
  const { Client } = apiRequire('pg');
  const dotenv = apiRequire('dotenv');
  const env = dotenv.parse(readFileSync(path.resolve(process.cwd(), '../api/.env')));
  const db = new Client({ connectionString: env.DATABASE_URL });
  await db.connect();
  try {
    const rows = await db.query('SELECT id FROM "User" WHERE username=ANY($1::text[])', [[first.username, second.username]]);
    const ids = [...new Set([...createdIds, ...rows.rows.map((row: { id: string }) => row.id)])];
    if (ids.length) await db.query('DELETE FROM "User" WHERE id=ANY($1::text[])', [ids]);
  } finally { await db.end(); }
});

test('perfiles guardados, respuestas, Nitido y avisos privados de mensajes', async ({ page, browser, request }) => {
  test.setTimeout(180_000);
  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  const status = 'Estudiando ' + suffix;
  const postText = 'Publicación con respuestas ' + suffix;
  const commentText = 'Comentario principal ' + suffix;
  const replyText = 'Respuesta del autor ' + suffix;
  try {
    const users: { id: string }[] = [];
    for (const account of [first, second]) {
      const response = await request.post(backend + '/auth/register', { data: { ...account, password } });
      expect(response.status()).toBe(201);
      const user = await response.json();
      users.push(user); createdIds.push(user.id);
    }
    const [a, b] = users;
    await login(page, first.email);
    await login(pageB, second.email);

    await test.step('el estado y tema se guardan para el dueño, visitantes y otro usuario', async () => {
      await page.goto('/perfil/' + first.username);
      await page.getByRole('button', { name: 'Editar mi perfil', exact: true }).click();
      await page.getByLabel('Estado', { exact: true }).fill(status);
      await page.getByLabel('Tema de perfil', { exact: true }).selectOption('ocean');
      await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
      await expect(page.locator('.profile-status')).toHaveText(status);
      await expect(page.locator('.profile-view')).toHaveAttribute('data-theme', 'ocean');
      // El alias no debe ocupar una franja adicional sobre la portada.
      await expect(page.locator('.profile-topline')).toHaveCount(0);
      mkdirSync(path.resolve(process.cwd(),'../../.artifacts'),{recursive:true});
      await page.screenshot({path:path.resolve(process.cwd(),'../../.artifacts/profile-theme.png'),fullPage:true});
      await page.reload();
      await expect(page.locator('.profile-status')).toHaveText(status);
      await expect(page.locator('.profile-view')).toHaveAttribute('data-theme', 'ocean');
      await pageB.goto('/perfil/' + first.username);
      await expect(pageB.locator('.profile-status')).toHaveText(status);
      await expect(pageB.locator('.profile-view')).toHaveAttribute('data-theme', 'ocean');
      const publicContext = await browser.newContext({ javaScriptEnabled: false });
      try {
        const publicPage = await publicContext.newPage();
        await publicPage.goto('/perfil/' + first.username);
        await expect(publicPage.locator('.profile-status')).toHaveText(status);
        await expect(publicPage.locator('[data-theme="ocean"]')).toBeVisible();
      } finally { await publicContext.close(); }
      const invalidTheme = await page.request.patch('/api/backend/users/me', { headers: { Origin: 'http://localhost:3000' }, data: { profileTheme: 'arbitrary-css' } });
      expect(invalidTheme.status()).toBe(400);
      const invalidStatus = await page.request.patch('/api/backend/users/me', { headers: { Origin: 'http://localhost:3000' }, data: { statusMessage: 'x'.repeat(81) } });
      expect(invalidStatus.status()).toBe(400);
    });

    let postId = '', commentId = '', replyId = '';
    await test.step('comentar y responder, con reacciones de comentario persistentes', async () => {
      await page.goto('/feed');
      await page.locator('#new-post').fill(postText);
      const publication = page.waitForResponse(response => response.url().endsWith('/api/backend/posts') && response.request().method() === 'POST');
      await page.getByRole('button', { name: 'Publicar', exact: true }).click();
      const published = await publication; expect(published.status()).toBe(201);
      postId = (await published.json()).id;
      await pageB.goto('/feed?post=' + postId);
      const postB = pageB.locator('#post-' + postId).first();
      await postB.getByRole('button', { name: /Comentarios/ }).click();
      await postB.getByLabel('Escribe un comentario', { exact: true }).fill(commentText);
      const commentRequest = pageB.waitForResponse(response => response.url().includes('/api/backend/posts/' + postId + '/comments') && response.request().method() === 'POST');
      await postB.getByRole('button', { name: 'Enviar comentario', exact: true }).click();
      const commentResponse = await commentRequest; expect(commentResponse.status()).toBe(201);
      commentId = (await commentResponse.json()).id;
      await expect(postB.locator('#comment-' + commentId)).toContainText(commentText);

      await page.goto('/feed?post=' + postId + '&comment=' + commentId);
      const parentA = page.locator('#comment-' + commentId).first();
      await expect(parentA).toBeVisible();
      await parentA.getByRole('button', { name: 'Responder', exact: true }).first().click();
      await parentA.locator('..').locator('.reply-form').getByLabel('Tu respuesta', { exact: true }).fill(replyText);
      const replyRequest = page.waitForResponse(response => response.url().includes('/api/backend/posts/' + postId + '/comments') && response.request().method() === 'POST');
      await parentA.locator('..').locator('.reply-form').getByRole('button', { name: 'Enviar respuesta', exact: true }).click();
      const replyResponse = await replyRequest; expect(replyResponse.status()).toBe(201);
      replyId = (await replyResponse.json()).id;
      await expect(page.locator('#comment-' + replyId).first()).toContainText(replyText);
      const react = parentA.getByRole('button', { name: 'Nitido en comentario', exact: true }).first();
      await react.click();
      await expect(react).toHaveAttribute('aria-pressed', 'true');
      await expect(react).toContainText('1');
      await page.reload();
      await expect(page.locator('#comment-' + commentId).first().getByRole('button', { name: 'Nitido en comentario', exact: true }).first()).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('#comment-' + replyId).first()).toContainText(replyText);
    });

    await test.step('las notificaciones se cargan y abren el comentario o respuesta exactos', async () => {
      await pageB.goto('/notificaciones');
      const response = await pageB.request.get('/api/backend/notifications?limit=50');
      expect(response.ok()).toBe(true);
      const notices = await response.json();
      const replyNotice = notices.find((notice: { type: string; commentId?: string }) => notice.type === 'COMMENT_REPLY' && notice.commentId === replyId);
      const likeNotice = notices.find((notice: { type: string; commentId?: string }) => notice.type === 'COMMENT_LIKE' && notice.commentId === commentId);
      expect(replyNotice).toBeTruthy(); expect(likeNotice).toBeTruthy();
      await expect(pageB.locator('.notification-item')).not.toHaveCount(0);
      const exactReplyLink = pageB.locator('.notification-copy a[href*="comment=' + replyId + '"]');
      await expect(exactReplyLink).toBeVisible();
      await exactReplyLink.click();
      await expect(pageB).toHaveURL(new RegExp('post=' + postId + '.*comment=' + replyId));
      await expect(pageB.locator('#comment-' + replyId).first()).toBeVisible();
      // Una recarga debe conservar la bandeja, no depender únicamente del evento del socket.
      await pageB.goto('/notificaciones'); await pageB.reload();
      await expect(pageB.locator('.notification-copy a[href*="comment=' + commentId + '"]')).toBeVisible();
    });

    await test.step('mensajes muestran un aviso temporal y punto propio sin entrar a la campana', async () => {
      await page.goto('/feed');
      await pageB.goto('/mensajes?to=' + a.id);
      await expect(pageB.getByLabel('Tu mensaje', { exact: true })).toBeVisible();
      const before = await (await page.request.get('/api/backend/notifications?limit=50')).json();
      const messageText = 'Mensaje temporal ' + suffix;
      await pageB.getByLabel('Tu mensaje', { exact: true }).fill(messageText);
      await pageB.getByRole('button', { name: 'Enviar mensaje', exact: true }).click();
      const toast = page.locator('.message-toast').filter({ hasText: messageText });
      await expect(toast).toBeVisible();
      await page.screenshot({path:path.resolve(process.cwd(),'../../.artifacts/message-toast.png')});
      const dot = page.getByTestId('message-unread-dot').first();
      await expect(dot).toBeVisible();
      await expect(toast).not.toBeVisible({ timeout: 12_000 });
      await expect(dot).toBeVisible();
      await page.reload();
      await expect(dot).toBeVisible();
      const after = await (await page.request.get('/api/backend/notifications?limit=50')).json();
      expect(after.some((notice: { type: string }) => notice.type === 'MESSAGE')).toBe(false);
      expect(after.map((notice: { id: string }) => notice.id).sort()).toEqual(before.map((notice: { id: string }) => notice.id).sort());

      const dismissedText = 'Aviso para cerrar ' + suffix;
      await pageB.getByLabel('Tu mensaje', { exact: true }).fill(dismissedText);
      await pageB.getByRole('button', { name: 'Enviar mensaje', exact: true }).click();
      const dismissed = page.locator('.message-toast').filter({ hasText: dismissedText });
      await expect(dismissed).toBeVisible();
      await dismissed.getByRole('button', { name: 'Cerrar aviso de mensaje', exact: true }).click();
      await expect(dismissed).not.toBeVisible(); await expect(dot).toBeVisible();

      const openedText = 'Abrir conversación ' + suffix;
      await pageB.getByLabel('Tu mensaje', { exact: true }).fill(openedText);
      await pageB.getByRole('button', { name: 'Enviar mensaje', exact: true }).click();
      const opened = page.locator('.message-toast').filter({ hasText: openedText });
      await expect(opened).toBeVisible(); await page.bringToFront(); await opened.getByRole('link').click();
      await expect(page).toHaveURL(new RegExp('/mensajes\\?to=' + b.id));
      await expect(page.locator('.message-bubble').filter({ hasText: openedText })).toHaveCount(1);
      await expect(dot).not.toBeVisible();
      const unread = await (await page.request.get('/api/backend/chat/unread')).json();
      expect(unread.count).toBe(0);
    });
  } finally { await contextB.close(); }
});
