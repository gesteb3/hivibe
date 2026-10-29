# Módulo social (Chepe) — contrato para Daniel y Gustavo

Todas las rutas llevan prefijo `/api`, exigen `Authorization: Bearer <JWT>` y están en Swagger (`/api/docs`).
Los ids son strings. Fechas en ISO 8601 (UTC).

## Paginación (`page` / `limit`)
`?page=1&limit=20` (page ≥ 1, limit 1–50, default 20). Respuesta de listas:
```json
{ "data": [ ... ], "meta": { "page": 1, "limit": 20, "total": 57, "totalPages": 3 } }
```

## Post
```json
{
  "id": "…", "body": "texto o null", "imageUrl": "https://… o null",
  "author": { "id": "…", "username": "chepe", "displayName": "Chepe", "avatarUrl": null },
  "likesCount": 3, "commentsCount": 1, "likedByMe": false,
  "createdAt": "2026-10-26T15:30:00.000Z", "updatedAt": "2026-10-26T15:30:00.000Z"
}
```
Un post necesita `body` y/o `imageUrl`.

## Flujo para publicar con imagen (Gustavo)
1. `POST /api/media/upload` (multipart, campo `file`, máx. 5 MB, JPG/PNG/WEBP/GIF) → `{ "url": "https://res.cloudinary.com/…" , … }`
2. `POST /api/posts` con `{ "body": "…", "imageUrl": "<url del paso 1>" }`

## Endpoints
| Método | Ruta | Éxito | Errores |
|---|---|---|---|
| POST | `/posts` | 201 Post | 400, 401 |
| GET | `/posts/:id` | 200 Post | 401, 404 |
| DELETE | `/posts/:id` | 200 `{deleted,id}` | 401, 403, 404 |
| GET | `/users/:id/posts` *(extra, muro del perfil)* | 200 lista de Post | 401, 404 |
| GET | `/feed` | 200 lista de Post | 401 |
| GET | `/feed/following` | 200 lista de Post (solo de Panas) | 401 |
| POST | `/media/upload` | 201 `{url,publicId,width,height,format,bytes}` | 400, 401, 413, 503 |
| POST | `/posts/:id/like` | 201 `{postId,liked:true,likesCount}` | 401, 404, **409** ya tenía like |
| DELETE | `/posts/:id/like` | 200 `{postId,liked:false,likesCount}` | 401, 404 |
| GET | `/posts/:id/comments` | 200 lista de Comentario (antiguos primero) | 401, 404 |
| POST | `/posts/:id/comments` | 201 Comentario + `commentsCount` | 400, 401, 404 |
| DELETE | `/comments/:id` | 200 `{deleted,id,postId,commentsCount}` | 401, 403, 404 |
| POST | `/users/:id/follow` | 201 `{userId,following:true,followersCount}` | 400 (a sí mismo), 401, 404, **409** |
| DELETE | `/users/:id/follow` | 200 `{userId,following:false,followersCount}` | 400, 401, 404 |
| GET | `/users/:id/followers` | 200 lista de Pana | 401, 404 |
| GET | `/users/:id/following` | 200 lista de Pana | 401, 404 |

Comentario: `{ id, postId, body, author{…}, createdAt }`.
Pana: `{ id, username, displayName, avatarUrl, isFollowedByMe }`.

## Para Daniel: eventos internos (EventEmitter2)
Se emiten con `@nestjs/event-emitter`. Daniel los escucha con `@OnEvent(...)` para crear
notificaciones y emitir por Socket.IO. Constantes en `social/social.events.ts`.

| Evento | Payload | Notificación sugerida |
|---|---|---|
| `social.like.created` | `{ postId, postAuthorId, actorId }` | like → avisar a `postAuthorId` (si ≠ actor) |
| `social.comment.created` | `{ postId, commentId, postAuthorId, actorId }` | comentario → avisar a `postAuthorId` (si ≠ actor) |
| `social.follow.created` | `{ followerId, followingId }` | nuevo Pana → avisar a `followingId` |
| `social.counts.changed` | `{ postId, likesCount, commentsCount }` | emitir `post:counts` por Socket.IO |
| `social.post.created` / `social.like.removed` / `social.comment.removed` / `social.follow.removed` | ver `social.events.ts` | opcionales |

Requiere `EventEmitterModule.forRoot()` en `AppModule`. Si no está, el módulo social funciona igual (sin emitir).

## Reglas de negocio
- Borrar post o comentario: solo el autor (403 si no). Borrar un post borra sus likes y comentarios.
- Like y follow duplicados → **409**. Quitar un like/follow que no existe → **404**.
- Nadie puede seguirse a sí mismo (400).
- `/feed/following` muestra solo publicaciones de los Panas, no las propias.
