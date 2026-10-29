require('dotenv').config({ quiet: true });
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const { Client } = require('pg');
const { io } = require('socket.io-client');
const { JwtService } = require('@nestjs/jwt');
const { execFileSync } = require('node:child_process');

const base = process.env.TEST_API_URL || 'http://localhost:4300';
const origin = process.env.FRONTEND_URL;
const sockets = [];
const ids = [];
const password = randomBytes(18).toString('hex');
const suffix = randomBytes(5).toString('hex');
async function api(
  path,
  { token, body, method = 'GET', status = 200, headers = {} } = {},
) {
  const response = await fetch(base + '/api' + path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(10000),
  });
  assert.equal(
    response.status,
    status,
    method + ' ' + path + ' respondió ' + response.status,
  );
  return response.json();
}
function event(socket, name, predicate = () => true, timeout = 6000) {
  return new Promise((resolve, reject) => {
    const handler = (data) => {
      if (predicate(data)) {
        clearTimeout(timer);
        socket.off(name, handler);
        resolve(data);
      }
    };
    const timer = setTimeout(() => {
      socket.off(name, handler);
      reject(new Error('No llegó ' + name));
    }, timeout);
    socket.on(name, handler);
  });
}
function connect(token, transport = 'websocket', socketOrigin = origin) {
  const socket = io(base, {
    autoConnect: false,
    transports: [transport],
    reconnection: false,
    auth: { token },
    extraHeaders: { Origin: socketOrigin },
    timeout: 5000,
  });
  sockets.push(socket);
  return socket;
}
async function open(socket) {
  const snapshot = event(socket, 'presence:snapshot');
  socket.connect();
  return snapshot;
}
async function ready() {
  for (let i = 0; i < 50; i++) {
    try {
      if (
        (
          await fetch(base + '/api/health', {
            signal: AbortSignal.timeout(1500),
          })
        ).ok
      )
        return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('La API no arrancó');
}
void test(
  'HiVibe: integración real REST, PostgreSQL, Socket.IO y persistencia',
  { timeout: 120000 },
  async (t) => {
    const db = new Client({ connectionString: process.env.DATABASE_URL });
    await db.connect();
    let a, b, c, post, conversation, image, message;
    try {
      await t.test('Swagger público y health responden', async () => {
        await ready();
        await api('/health');
        const docs = await fetch(base + '/api/docs');
        assert.equal(docs.status, 200);
        const spec = await api('/docs-json');
        assert.ok(spec.paths['/api/chat/conversations/{id}/messages']);
        assert.ok(spec.components.schemas.CreateMessageDto);
      });
      await t.test(
        'tres cuentas: registro, duplicados, Argon2id y login real',
        async () => {
          const accounts = [];
          for (const letter of ['a', 'b', 'c']) {
            const email = letter + suffix + '@example.com';
            const body = {
              username: letter + suffix,
              email,
              password,
              displayName: 'Prueba ' + letter,
            };
            const user = await api('/auth/register', {
              method: 'POST',
              body,
              status: 201,
            });
            ids.push(user.id);
            assert.equal(user.passwordHash, undefined);
            const login = await api('/auth/login', {
              method: 'POST',
              body: { email, password },
            });
            accounts.push({ ...user, token: login.accessToken });
          }
          [a, b, c] = accounts;
          await api('/auth/register', {
            method: 'POST',
            status: 409,
            body: {
              username: a.username,
              email: a.email,
              password,
              displayName: 'Duplicado',
            },
          });
          await api('/auth/login', {
            method: 'POST',
            status: 401,
            body: { email: a.email, password: 'incorrecta123' },
          });
          const row = await db.query(
            'SELECT "passwordHash" FROM "User" WHERE id=$1',
            [a.id],
          );
          assert.match(row.rows[0].passwordHash, /^\$argon2id\$/);
        },
      );
      await t.test(
        'JWT obligatorio, errores coherentes, DTO estricto y rate limit',
        async () => {
          await api('/users/me', { status: 401 });
          const bad = await api('/users/me', {
            token: 'invalido',
            status: 401,
          });
          assert.ok(bad.timestamp);
          assert.equal(bad.stack, undefined);
          await api('/auth/register', {
            method: 'POST',
            status: 400,
            body: {
              username: '!',
              email: 'no',
              password: '1',
              displayName: ' ',
              extra: true,
            },
          });
          await api('/auth/register', {
            method: 'POST',
            status: 429,
            body: {},
          });
          await api('/users/me', {
            method: 'PATCH',
            token: a.token,
            status: 400,
            body: { id: b.id },
          });
        },
      );
      await t.test(
        'autenticación y origen rechazados antes de admitir sockets',
        async () => {
          for (const [token, transport, socketOrigin] of [
            ['', 'websocket', origin],
            ['invalido', 'polling', origin],
            [a.token, 'websocket', 'https://ajeno.invalid'],
            [a.token, 'polling', 'https://ajeno.invalid'],
          ]) {
            const socket = connect(token, transport, socketOrigin);
            const error = event(socket, 'connect_error');
            socket.connect();
            await error;
            assert.equal(socket.connected, false);
            socket.disconnect();
          }
          const allowed = await fetch(
            base + '/socket.io/?EIO=4&transport=polling',
            { headers: { Origin: origin } },
          );
          assert.equal(
            allowed.headers.get('access-control-allow-origin'),
            origin,
          );
        },
      );
      const sa = connect(a.token),
        sb = connect(b.token, 'polling'),
        sc = connect(c.token);
      await t.test('presencia inicial y múltiples pestañas', async () => {
        await open(sa);
        const initial = await open(sb);
        assert.ok(initial.userIds.includes(a.id));
        await open(sc);
        const secondA = connect(a.token);
        await open(secondA);
        let offline = false;
        const watch = (data) => {
          if (data.userId === a.id && !data.online) offline = true;
        };
        sb.on('presence:update', watch);
        secondA.disconnect();
        await new Promise((r) => setTimeout(r, 150));
        assert.equal(offline, false);
        sb.off('presence:update', watch);
      });
      await t.test(
        'imagen real y publicación; permisos de borrado',
        async () => {
          const png = Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aO2kAAAAASUVORK5CYII=',
            'base64',
          );
          const form = new FormData();
          form.append(
            'file',
            new Blob([png], { type: 'image/png' }),
            'prueba.png',
          );
          const response = await fetch(base + '/api/media/upload', {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + a.token },
            body: form,
          });
          assert.equal(response.status, 201);
          image = await response.json();
          assert.deepEqual(
            Buffer.from(await (await fetch(image.url)).arrayBuffer()),
            png,
          );
          const fake = new FormData();
          fake.append(
            'file',
            new Blob(['no soy imagen'], { type: 'image/png' }),
            'falso.png',
          );
          assert.equal(
            (
              await fetch(base + '/api/media/upload', {
                method: 'POST',
                headers: { Authorization: 'Bearer ' + a.token },
                body: fake,
              })
            ).status,
            400,
          );
          const oversized = new FormData();
          oversized.append(
            'file',
            new Blob([Buffer.alloc(5 * 1024 * 1024 + 1)], {
              type: 'image/png',
            }),
            'grande.png',
          );
          assert.equal(
            (
              await fetch(base + '/api/media/upload', {
                method: 'POST',
                headers: { Authorization: 'Bearer ' + a.token },
                body: oversized,
              })
            ).status,
            413,
          );
          post = await api('/posts', {
            method: 'POST',
            token: a.token,
            status: 201,
            body: { body: 'Publicación de integración', imageUrl: image.url },
          });
          await api('/posts/' + post.id, {
            method: 'DELETE',
            token: b.token,
            status: 403,
          });
        },
      );
      await t.test(
        'likes, comentarios, seguimiento, feeds y contadores en vivo',
        async () => {
          const counts = event(
            sa,
            'post:counts',
            (x) => x.postId === post.id && x.likesCount === 1,
          );
          const notification = event(
            sa,
            'notification:new',
            (x) => x.type === 'LIKE' && x.postId === post.id,
          );
          await api('/posts/' + post.id + '/like', {
            method: 'POST',
            token: b.token,
            status: 201,
          });
          await counts;
          const notice = await notification;
          assert.equal(notice.actor.username, b.username);
          await api('/posts/' + post.id + '/like', {
            method: 'POST',
            token: b.token,
            status: 409,
          });
          const commentCounts = event(
            sa,
            'post:counts',
            (x) => x.postId === post.id && x.commentsCount === 1,
          );
          const comment = await api('/posts/' + post.id + '/comments', {
            method: 'POST',
            token: b.token,
            status: 201,
            body: { body: 'Comentario real' },
          });
          await commentCounts;
          await api('/comments/' + comment.id, {
            method: 'DELETE',
            token: a.token,
            status: 403,
          });
          await api('/users/' + a.id + '/follow', {
            method: 'POST',
            token: b.token,
            status: 201,
          });
          await api('/users/' + b.id + '/follow', {
            method: 'POST',
            token: b.token,
            status: 400,
          });
          const feed = await api('/feed/following', { token: b.token });
          assert.ok(feed.data.some((x) => x.id === post.id));
          await api('/feed?page=Infinity&limit=Infinity', { token: b.token });
          const profile = await api('/users/' + a.username);
          assert.equal(profile.followersCount, 1);
          assert.equal(profile.email, undefined);
          const relationship = await api(
            '/users/' + a.username + '/relationship',
            { token: b.token },
          );
          assert.equal(relationship.isFollowedByMe, true);
        },
      );

      await t.test(
        'estado y tema guardados, respuestas y Nitido en comentarios',
        async () => {
          await api('/users/me', {
            method: 'PATCH',
            token: a.token,
            body: { statusMessage: 'Estudiando', profileTheme: 'ocean' },
          });
          const profile = await api('/users/' + a.username);
          assert.equal(profile.statusMessage, 'Estudiando');
          assert.equal(profile.profileTheme, 'ocean');
          await api('/users/me', {
            method: 'PATCH',
            token: a.token,
            status: 400,
            body: { profileTheme: 'css-libre' },
          });
          await api('/users/me', {
            method: 'PATCH',
            token: a.token,
            status: 400,
            body: { statusMessage: 'x'.repeat(81) },
          });
          const roots = await api('/posts/' + post.id + '/comments', {
            token: a.token,
          });
          const root = roots.data[0];
          assert.ok(root);
          assert.equal(root.parentId, null);
          const replyNotice = event(
            sb,
            'notification:new',
            (x) => x.type === 'COMMENT_REPLY',
          );
          const reply = await api('/posts/' + post.id + '/comments', {
            method: 'POST',
            token: a.token,
            status: 201,
            body: { body: 'Respuesta al comentario', parentId: root.id },
          });
          const notice = await replyNotice;
          assert.equal(notice.commentId, reply.id);
          assert.equal(notice.postId, post.id);
          const detail = await api('/comments/' + reply.id, { token: b.token });
          assert.equal(detail.rootId, root.id);
          const replies = await api('/comments/' + root.id + '/replies', {
            token: b.token,
          });
          assert.ok(replies.data.some((x) => x.id === reply.id));
          await api('/posts/' + post.id + '/comments', {
            method: 'POST',
            token: a.token,
            status: 400,
            body: { body: 'Nivel no permitido', parentId: reply.id },
          });
          const unlikeNotice = event(
            sb,
            'notification:new',
            (x) => x.type === 'COMMENT_LIKE' && x.commentId === root.id,
          );
          await api('/comments/' + root.id + '/like', {
            method: 'POST',
            token: a.token,
            status: 201,
          });
          await unlikeNotice;
          const liked = await api('/comments/' + root.id, { token: a.token });
          assert.equal(liked.likesCount, 1);
          assert.equal(liked.likedByMe, true);
          const unliked = await api('/comments/' + root.id, { token: c.token });
          assert.equal(unliked.likedByMe, false);
          await api('/comments/' + root.id + '/like', {
            method: 'POST',
            token: a.token,
            status: 409,
          });
          await api('/comments/' + root.id + '/like', {
            method: 'DELETE',
            token: c.token,
            status: 404,
          });
          await api('/comments/' + root.id + '/like', {
            method: 'DELETE',
            token: a.token,
          });
          await api('/comments/' + reply.id, {
            method: 'DELETE',
            token: c.token,
            status: 403,
          });
          const foreignPost = await api('/posts', {
            method: 'POST',
            token: c.token,
            status: 201,
            body: { body: 'Otro post' },
          });
          await api('/posts/' + foreignPost.id + '/comments', {
            method: 'POST',
            token: c.token,
            status: 400,
            body: { body: 'Padre ajeno', parentId: root.id },
          });
        },
      );
      await t.test(
        'chat privado persistido, entrega a ambos y aislamiento del tercero',
        async () => {
          conversation = await api('/chat/conversations', {
            method: 'POST',
            token: a.token,
            status: 201,
            body: { recipientId: b.id },
          });
          const inverse = await api('/chat/conversations', {
            method: 'POST',
            token: b.token,
            status: 201,
            body: { recipientId: a.id },
          });
          assert.equal(inverse.id, conversation.id);
          let leaked = false;
          const spy = () => {
            leaked = true;
          };
          sc.on('chat:new', spy);
          const incomingA = event(sa, 'chat:new'),
            incomingB = event(sb, 'chat:new');
          message = await api(
            '/chat/conversations/' + conversation.id + '/messages',
            {
              method: 'POST',
              token: a.token,
              status: 201,
              body: { content: 'Mensaje persistente' },
            },
          );
          assert.equal((await incomingA).id, message.id);
          assert.equal((await incomingB).id, message.id);
          await api('/chat/conversations/' + conversation.id + '/messages', {
            token: c.token,
            status: 403,
          });
          await api('/chat/conversations/' + conversation.id + '/messages', {
            method: 'POST',
            token: c.token,
            status: 403,
            body: { content: 'intruso' },
          });
          assert.equal(leaked, false);
          sc.off('chat:new', spy);
          for (const content of [
            123,
            {},
            '',
            ' '.repeat(10),
            'x'.repeat(2001),
          ]) {
            await api('/chat/conversations/' + conversation.id + '/messages', {
              method: 'POST',
              token: a.token,
              status: 400,
              body: { content },
            });
          }
          await api('/chat/conversations', {
            method: 'POST',
            token: a.token,
            status: 400,
            body: {},
          });
          await api(
            '/chat/conversations/' +
              conversation.id +
              '/messages?limit=Infinity',
            { token: a.token, status: 400 },
          );
        },
      );

      await t.test(
        'mensajes no entran a notificaciones; lectura y contadores persisten',
        async () => {
          assert.equal(
            (await api('/chat/unread', { token: b.token })).count,
            1,
          );
          assert.equal(
            (await api('/chat/unread', { token: a.token })).count,
            0,
          );
          await api('/chat/conversations/' + conversation.id + '/read', {
            method: 'PATCH',
            token: c.token,
            status: 403,
          });
          const unreadEvent = event(sb, 'chat:unread', (x) => x.count === 0);
          await api('/chat/conversations/' + conversation.id + '/read', {
            method: 'PATCH',
            token: b.token,
          });
          await unreadEvent;
          assert.equal(
            (await api('/chat/unread', { token: b.token })).count,
            0,
          );
          const count = await db.query(
            'SELECT count(*)::int AS count FROM "Notification" WHERE "userId"=$1 AND type=\'MESSAGE\'',
            [b.id],
          );
          assert.equal(count.rows[0].count, 0);
          await db.query(
            'INSERT INTO "Notification" (id,"userId","actorId",type,"isRead","createdAt") VALUES ($1,$2,$3,\'MESSAGE\',false,NOW())',
            [randomUUID(), b.id, a.id],
          );
          assert.ok(
            (await api('/notifications', { token: b.token })).every(
              (n) => n.type !== 'MESSAGE',
            ),
          );
          const expected = await db.query(
            'SELECT count(*)::int AS count FROM "Notification" WHERE "userId"=$1 AND type<>\'MESSAGE\' AND "isRead"=false',
            [b.id],
          );
          assert.equal(
            (await api('/notifications/unread', { token: b.token })).count,
            expected.rows[0].count,
          );
        },
      );
      await t.test(
        'más de 100 mensajes: ventana reciente y recuperación completa por cursor',
        async () => {
          const values = Array.from({ length: 105 }, (_, i) => ({
            id: randomUUID(),
            text: 'Historial ' + i,
          }));
          for (const value of values)
            await db.query(
              'INSERT INTO "Message" (id,"conversationId","senderId",content,"createdAt") VALUES ($1,$2,$3,$4,NOW())',
              [value.id, conversation.id, a.id, value.text],
            );
          const expected = (
            await db.query(
              'SELECT id FROM "Message" WHERE "conversationId"=$1 ORDER BY "createdAt",id',
              [conversation.id],
            )
          ).rows.map((x) => x.id);
          let page = await api(
            '/chat/conversations/' + conversation.id + '/messages',
            { token: a.token },
          );
          assert.equal(page.length, 50);
          assert.deepEqual(
            page.map((x) => x.id),
            expected.slice(-50),
          );
          let recovered = [...page];
          while (page.length) {
            page = await api(
              '/chat/conversations/' +
                conversation.id +
                '/messages?before=' +
                page[0].id,
              { token: a.token },
            );
            recovered = [...page, ...recovered];
          }
          assert.deepEqual(
            recovered.map((x) => x.id),
            expected,
          );
        },
      );
      await t.test(
        'notificaciones con actor y lectura restringida al destinatario',
        async () => {
          const notices = await api('/notifications', { token: a.token });
          const notice = notices.find(
            (x) => x.type === 'LIKE' && x.postId === post.id,
          );
          assert.ok(notice);
          assert.equal(notice.actor.id, b.id);
          await api('/notifications/' + notice.id + '/read', {
            method: 'PATCH',
            token: b.token,
            status: 404,
          });
          assert.equal(
            (
              await api('/notifications/' + notice.id + '/read', {
                method: 'PATCH',
                token: a.token,
              })
            ).isRead,
            true,
          );
        },
      );
      await t.test('JWT expirado corta un socket ya abierto', async () => {
        const jwt = new JwtService({ secret: process.env.JWT_SECRET });
        const short = jwt.sign(
          { sub: a.id },
          { expiresIn: 3, algorithm: 'HS256' },
        );
        const socket = connect(short);
        await open(socket);
        const disconnected = event(socket, 'disconnect', () => true, 5000);
        await disconnected;
        assert.equal(socket.connected, false);
      });
      await t.test(
        'reiniciar contenedor conserva imagen, publicaciones e historial',
        async () => {
          for (const socket of sockets) socket.disconnect();
          execFileSync('docker', ['compose', 'restart', 'api'], {
            stdio: 'pipe',
            timeout: 30000,
          });
          await ready();
          assert.equal((await fetch(image.url)).status, 200);
          assert.equal(
            (await api('/posts/' + post.id, { token: a.token })).id,
            post.id,
          );
          const history = await api(
            '/chat/conversations/' + conversation.id + '/messages?limit=100',
            { token: a.token },
          );
          assert.equal(history.length, 100);
        },
      );
    } finally {
      for (const socket of sockets) socket.disconnect();
      if (ids.length)
        await db.query('DELETE FROM "User" WHERE id=ANY($1::text[])', [ids]);
      await db.end();
    }
  },
);
