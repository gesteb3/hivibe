# HiVibe API

Backend NestJS con PostgreSQL/Prisma, hash Argon2id, JWT de una hora, módulos sociales y Socket.IO autenticado.

## Ejecución

Desde esta carpeta: npm ci, npm run setup:local y docker compose up -d --build --wait. La configuración detallada está en el [README raíz](../../README.md). Swagger: http://localhost:4300/api/docs; OpenAPI: http://localhost:4300/api/docs-json. Son direcciones locales.

## Contrato REST

Todas las rutas siguientes llevan /api. Salvo health, auth y perfil público, requieren Bearer JWT.

| Método | Ruta | Respuesta |
|---|---|---|
| GET | /health | estado del servidor |
| POST | /auth/register | usuario propio sin hash; no inicia sesión |
| POST | /auth/login | accessToken, tokenType, expiresIn, user |
| GET/PATCH | /users/me | perfil propio; actualización por JWT |
| GET | /users/:username | perfil público con postsCount, followersCount, followingCount |
| GET | /users/:username/relationship | userId, isFollowedByMe; autenticado |
| GET | /feed, /feed/following | lista paginada de posts |
| GET | /users/:id/posts | muro paginado |
| POST | /posts | body y/o imageUrl |
| GET/DELETE | /posts/:id | detalle / borrar solo propio |
| POST | /media/upload | FormData file; url, publicId, format, bytes; Cloudinary añade dimensiones |
| POST/DELETE | /posts/:id/like | liked, likesCount |
| GET/POST | /posts/:id/comments | lista / crear con body |
| DELETE | /comments/:id | borrar solo propio |
| POST/DELETE | /users/:id/follow | seguir/dejar de seguir |
| GET | /users/:id/followers, /users/:id/following | lista paginada de perfiles |
| GET/POST | /chat/conversations | array de conversaciones / crear con recipientId UUID |
| GET | /chat/conversations/:id/messages | array cronológico de ventana reciente, limit 1–100, before opcional |
| POST | /chat/conversations/:id/messages | enviar con content, 1–2000 caracteres; persistir y emitir |
| GET | /notifications | array reciente con actor público; admite page/limit |
| PATCH | /notifications/:id/read | notificación con isRead=true; solo destinatario |

Listas sociales: { data, meta: { page, limit, total, totalPages } }. page=1, limit=20 por defecto y máximo 50. Valores inválidos normalizan a defaults seguros; el historial de chat rechaza consultas inválidas con 400.

El historial de chat devuelve los 50 más recientes en orden ascendente. Para cargar anteriores enviar before con el id del primero cargado; agregar la nueva ventana al inicio; [] indica final. Cursor ajeno a la conversación devuelve 404. No usar paginación del feed para chat.

## Tiempo real

Conectar socket.io-client a http://localhost:4300 (sin /api) con auth: { token: accessToken }. El servidor valida HS256, expiración y existencia del usuario ANTES de admitir el socket, restringe el origen tanto en polling como WebSocket y cierra la conexión al vencer el JWT.

| Evento recibido | Payload |
|---|---|
| chat:new | id, conversationId, senderId, content, createdAt |
| notification:new | notificación persistida con actor { id, username, displayName, avatarUrl } |
| post:counts | postId, likesCount, commentsCount |
| presence:snapshot | { userIds: [...] } al conectar |
| presence:update | { userId, online } al cambiar |

Mensajes/avisos privados solo se entregan a salas del usuario. Presencia y contadores se publican en sala autenticada. Presencia soporta varias pestañas, en una instancia. Antes de escalar a varias instancias se necesita estado compartido/adaptador Redis.

Enviar por REST, deduplicar por id porque el emisor recibe tanto la respuesta como chat:new. Al reconectar recuperar REST; no hay replay automático. Al salir eliminar token y cerrar socket. No registrar tokens ni guardar secretos en NEXT_PUBLIC_*.

## Seguridad y multimedia

Registro/login: cinco solicitudes por minuto, por IP y ruta, incluyendo exitosas. DTO estricto con rechazo de propiedades extra. Recursos ajenos: 403; registro/like/follow duplicado: 409. Errores: statusCode, error, message (texto o array), path, timestamp; sin stacktrace.

La configuración exige JWT_SECRET aleatorio de al menos 32 caracteres y origen frontend exacto. Imágenes: JPG/PNG/WebP/GIF, máximo 5 MB, extensión/MIME/firma, nombre aleatorio. Proveedor local en volumen persistente; HTTP solo localhost, HTTPS en público. El proveedor Cloudinary usa credenciales privadas de entorno. /media sirve archivos públicos con nosniff; no hay subida de SVG/HTML.

## Pruebas y límites

Ver comandos del README raíz. Las migraciones se conservan sin reescribir su historial. Se prueba migración desde BD vacía y reejecución sin pendientes. El contenedor ejecuta migraciones antes de servir, corre como usuario node y su etapa final omite herramientas de desarrollo. No contiene .env ni credenciales de build.

El frontend está implementado en apps/web; el despliegue público sigue pendiente. El README de auditoría original conserva hallazgos históricos; consultar CORRECCIONES.md para el cierre actual.
