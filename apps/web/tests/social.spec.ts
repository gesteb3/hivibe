import { test, expect, type Page } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const suffix = randomBytes(5).toString('hex');
const first = { username: 'qa_a_' + suffix, email: 'qa_a_' + suffix + '@example.com', displayName: 'QA Luna ' + suffix };
const second = { username: 'qa_b_' + suffix, email: 'qa_b_' + suffix + '@example.com', displayName: 'QA Sol ' + suffix };
const password = randomBytes(18).toString('hex');
const createdIds: string[] = [];
const backend = process.env.TEST_BACKEND_URL || 'http://localhost:4300/api';
const artifactDir = path.resolve(process.cwd(), '../../.artifacts');

async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole('button', { name: 'Entrar a mi espacio' }).click();
  await expect(page).toHaveURL(/\/feed/);
  await expect(page.locator('#new-post')).toBeVisible();
}

test.afterAll(async () => {
  // Solo elimina usuarios exactos de esta ejecución; no limpia datos ajenos.
  const apiRequire = createRequire(path.resolve(process.cwd(), '../api/package.json'));
  const { Client } = apiRequire('pg');
  const dotenv = apiRequire('dotenv');
  const env = dotenv.parse(readFileSync(path.resolve(process.cwd(), '../api/.env')));
  const db = new Client({ connectionString: env.DATABASE_URL });
  await db.connect();
  try {
    const rows = await db.query('SELECT id FROM "User" WHERE username=ANY($1::text[])', [[first.username, second.username]]);
    const ids = [...new Set([...createdIds, ...rows.rows.map((row: {id: string}) => row.id)])];
    if (ids.length) await db.query('DELETE FROM "User" WHERE id=ANY($1::text[])', [ids]);
  } finally {
    await db.end();
  }
});

test('la bienvenida se renderiza sin JavaScript y cabe en un celular', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  try {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Tu internet.');
    await expect(page.getByRole('link', { name: 'Aquí empieza mi vibe' })).toBeVisible();
    const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(hasOverflow).toBe(false);
  } finally {
    await context.close();
  }
});

test('dos cuentas usan la red social real: registro, publicación, interacción, perfil y chat', async ({ page, browser, request }) => {
  const secondContext = await browser.newContext();
  const pageB = await secondContext.newPage();
  const postText = 'Vibra de exposición ' + suffix;
  const commentText = 'Comentario de cuate ' + suffix;
  const messageText = 'Mensaje privado en vivo ' + suffix;
  let postId: string | undefined;
  mkdirSync(artifactDir, { recursive: true });
  try {
    await page.goto('/registro');
    await page.locator('input[name="displayName"]').fill(first.displayName);
    await page.locator('input[name="username"]').fill(first.username);
    await page.getByLabel('Correo electrónico').fill(first.email);
    await page.locator('input[name="password"]').fill(password);
    await page.getByRole('button', { name: 'Crear mi espacio' }).click();
    await expect(page).toHaveURL(/\/feed/);
    await expect(page.locator('#new-post')).toBeVisible();

    const profileResponse = await request.get(backend + '/users/' + first.username);
    expect(profileResponse.ok()).toBe(true);
    const profile = await profileResponse.json();
    createdIds.push(profile.id);
    const cookie = (await page.context().cookies()).find(value => value.name === 'hv_session');
    expect(cookie?.httpOnly).toBe(true);
    expect(await page.evaluate(() => localStorage.getItem('token') || localStorage.getItem('accessToken'))).toBeNull();

    const createB = await request.post(backend + '/auth/register', { data: { ...second, password } });
    expect(createB.status()).toBe(201);
    const userB = await createB.json();
    createdIds.push(userB.id);
    await login(pageB, second.email);

    await page.locator('#new-post').fill(postText);
    await page.locator('.composer input[type="file"]').setInputFiles({
      name: 'vibra-' + suffix + '.png',
      mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aO2kAAAAASUVORK5CYII=', 'base64'),
    });
    const publication = page.waitForResponse(response => response.url().endsWith('/api/backend/posts') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Publicar', exact: true }).click();
    const published = await publication;
    expect(published.status()).toBe(201);
    postId = (await published.json()).id;
    const postA = page.locator('#post-' + postId);
    await expect(postA).toContainText(postText);
    await expect(postA.locator('.post-image')).toBeVisible();
    await expect.poll(() => postA.locator('.post-image').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);

    await pageB.reload();
    const postB = pageB.locator('#post-' + postId);
    await expect(postB).toContainText(postText);
    await expect(postB.getByRole('button', { name: 'Eliminar publicación', exact: true })).toHaveCount(0);
    await postB.getByRole('button', { name: /Me vibra/ }).click();
    await expect(postB.getByRole('button', { name: /Me vibra/ })).toHaveAttribute('aria-pressed', 'true');
    // Este contador debe cambiar en A por Socket.IO, sin recargar A.
    await expect(postA.getByRole('button', { name: /Me vibra/ })).toContainText('1');
    await postB.getByRole('button', { name: /Comentarios/ }).click();
    await postB.getByLabel('Escribe un comentario').fill(commentText);
    await postB.getByRole('button', { name: 'Enviar comentario' }).click();
    await expect(postB).toContainText(commentText);
    await expect(postA.getByRole('button', { name: /Comentarios/ })).toContainText('1');
    await page.screenshot({ path: path.join(artifactDir, 'feed-desktop.png'), fullPage: true });

    await pageB.goto('/perfil/' + first.username);
    await expect(pageB.getByRole('heading', { level: 1, name: first.displayName })).toBeVisible();
    await pageB.getByRole('button', { name: 'Hacernos cuates' }).click();
    await expect(pageB.getByRole('button', { name: 'Siguiendo', exact: true })).toBeVisible();

    await page.goto('/perfil/' + first.username);
    await page.getByRole('button', { name: 'Editar mi perfil' }).click();
    await page.getByLabel('Sobre mí', { exact: true }).fill('Mi rincón retro ' + suffix);
    await page.getByRole('button', { name: 'Guardar mi estilo' }).click();
    await expect(page.locator('.profile-bio')).toHaveText('Mi rincón retro ' + suffix);
    await page.screenshot({ path: path.join(artifactDir, 'perfil-desktop.png'), fullPage: true });

    const publicContext = await browser.newContext({ javaScriptEnabled: false });
    try {
      const publicPage = await publicContext.newPage();
      await publicPage.goto('/perfil/' + first.username);
      await expect(publicPage.getByRole('heading', { level: 1, name: first.displayName })).toBeVisible();
      await expect(publicPage.getByText('Mi rincón retro ' + suffix, { exact: true })).toBeVisible();
      await expect(publicPage.getByRole('link', { name: 'Crear mi espacio', exact: true })).toBeVisible();
    } finally { await publicContext.close(); }

    const forgedLogout = await page.request.post('/api/logout', { headers: { Origin: 'https://ajeno.invalid' } });
    expect(forgedLogout.status()).toBe(403);
    expect((await page.context().cookies()).some(value => value.name === 'hv_session')).toBe(true);

    await page.goto('/notificaciones');
    await expect(page.locator('.notification-item').filter({ hasText: 'le dio like a tu publicación' })).toContainText(second.displayName);
    const likeNotice = page.locator('.notification-item').filter({ hasText: 'le dio like a tu publicación' });
    await likeNotice.getByRole('button', { name: 'Marcar notificación como leída' }).click();
    await expect(likeNotice).not.toHaveClass(/unread/);

    await page.goto('/mensajes?to=' + userB.id);
    await pageB.goto('/mensajes?to=' + profile.id);
    await expect(page.getByLabel('Tu mensaje', { exact: true })).toBeVisible();
    await expect(pageB.getByLabel('Tu mensaje', { exact: true })).toBeVisible();
    await page.getByLabel('Tu mensaje', { exact: true }).fill(messageText);
    await page.getByRole('button', { name: 'Enviar mensaje', exact: true }).click();
    await expect(page.locator('.message-bubble').filter({ hasText: messageText })).toHaveCount(1);
    await expect(pageB.locator('.message-bubble').filter({ hasText: messageText })).toHaveCount(1);
    await pageB.reload();
    await expect(pageB.locator('.message-bubble').filter({ hasText: messageText })).toHaveCount(1);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/feed');
    await expect(page.locator('#new-post')).toBeVisible();
    await expect(page.locator('#post-' + postId)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    await page.screenshot({ path: path.join(artifactDir, 'feed-mobile.png'), fullPage: true });
    await page.goto('/perfil/' + first.username);
    await expect(page.getByRole('heading', { level: 1, name: first.displayName })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    await page.screenshot({ path: path.join(artifactDir, 'perfil-mobile.png'), fullPage: true });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole('button', { name: /Cerrar sesión|Salir/ }).click();
    await expect(page).toHaveURL(/\/login|\/$/);
    await page.goto('/feed');
    await expect(page).toHaveURL(/\/login/);
  } finally {
    await secondContext.close();
  }
});
