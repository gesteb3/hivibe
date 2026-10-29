# HiVibe

Mini red social académica: perfiles, publicaciones con imágenes, likes, comentarios, seguimiento, feed, chat privado y notificaciones en tiempo real.

## Estado

Backend funcional en Docker local. El frontend de Gustavo está implementado en Next.js; ver apps/web/README.md. El despliegue público y el PDF final siguen pendientes; las direcciones localhost son exclusivamente de desarrollo.

| Recurso | Dirección |
|---|---|
| Repositorio | https://github.com/gesteb3/hivibe |
| API local / health | http://localhost:4300/api/health |
| Swagger local | http://localhost:4300/api/docs |
| OpenAPI JSON local | http://localhost:4300/api/docs-json |
| Frontend público | Pendiente de publicación |
| Backend / Swagger públicos | Pendientes de servidor y dominio |

## Tecnologías y arquitectura

NestJS, TypeScript, PostgreSQL 17, Prisma 7, Argon2id, JWT HS256, Socket.IO, Docker Compose. Imágenes en volumen persistente Docker o Cloudinary. Frontend: Next.js 16 / React 19.

```mermaid
flowchart LR
  Web["Frontend Next.js"] -->|REST + JWT| API["NestJS /api"]
  Web <-->|Socket.IO| API
  API --> DB[("PostgreSQL")]
  API --> Media["Volumen persistente / Cloudinary"]
  API --> Swagger["/api/docs"]
```

## Inicio local

Requiere Node.js 24, npm, Git y Docker Desktop con motor Linux activo. Desde la raíz:

```powershell
cd apps/api
npm ci
npm run setup:local
docker compose up -d --build --wait
```

El script setup:local crea un .env ignorado por Git con secretos aleatorios y conserva un .env existente. Compose aplica las migraciones antes de arrancar. API: puerto 4300; PostgreSQL: puerto 5433; ambos publicados únicamente en 127.0.0.1. No requiere cuentas cloud para usar imágenes locales.

Para detener: `docker compose down`. Los volúmenes conservan BD e imágenes. No usar `down -v` si se necesitan esos datos.

Para ejecutar Node con autorecarga y BD Docker:

```powershell
docker compose stop api
docker compose up -d db
npm run db:migrate
npm run start:dev
```

Ese modo guarda imágenes en apps/api/uploads; el modo contenedor usa su volumen propio. Para volver: detener Node y ejecutar `docker compose up -d api`.

## Variables

Ver [apps/api/.env.example](apps/api/.env.example). DATABASE_URL es para Node en el host; DOCKER_DATABASE_URL es para la red de Compose y usa db:5432. Ambas llevan la misma contraseña codificada para URL. POSTGRES_PASSWORD es la contraseña sin codificar. El script genera contraseñas hexadecimales para evitar ambigüedad de interpolación.

JWT_SECRET: al menos 32 caracteres aleatorios. FRONTEND_URL: origen exacto, sin barra final; por defecto http://localhost:3000. MEDIA_PROVIDER=local usa MEDIA_LOCAL_PATH y MEDIA_PUBLIC_URL; HTTP solo se admite para localhost. En producción usar HTTPS. Con cloudinary configurar las tres CLOUDINARY_*; Compose ya las pasa al contenedor.

Variables del frontend (sin secretos), en apps/web/.env.local:
```dotenv
API_URL=http://localhost:4300/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:4300
```

## Contrato e integración

Consultar [README de API](apps/api/README.md) y Swagger. Registro NO devuelve token: después ejecutar login. Autenticación REST con Authorization: Bearer TOKEN. No existe refresh/logout del servidor: borrar sesión y desconectar socket al salir, manejar 401/expiración.

Las rutas de chat son /api/chat/conversations, con recipientId para crear conversación y content para enviar mensajes por REST. Socket.IO recibe eventos; no implementa chat:send. Historial: ventana reciente ordenada cronológicamente, limit=50 por defecto (máximo 100); before=id_del_mensaje_más_antiguo recupera mensajes anteriores hasta recibir [].

## Verificación

Desde apps/api, con Docker levantado:

```powershell
npm run lint
npm run build
npm test -- --runInBand
npm run test:e2e -- --runInBand
npm run test:migrations
npm run test:integration
npm audit --omit=dev
```

test:integration usa cuentas efímeras y PostgreSQL real; prueba permisos con un tercero, imagen, feed, eventos, historial >100, expiración del socket y REINICIA el contenedor api para probar persistencia. Ejecutarlo solo en desarrollo, sin usuarios trabajando. Requiere el proveedor local, acceso Docker y secretos locales coincidentes. Limpia las cuentas creadas. test:migrations crea y elimina una BD aislada y verifica dos aplicaciones consecutivas.

El audit completo puede reportar seis alertas bajas transitivas de deepmerge/Jest en herramientas de desarrollo; el advisory no publica versión corregida. No se fuerza una degradación de Jest. Esas herramientas se excluyen de la imagen final. Ver [advisory](https://github.com/advisories/GHSA-gcqx-w48m-w2h4).

## Despliegue y entrega

Ver [DEPLOY.md](apps/api/DEPLOY.md), que incluye un Compose opcional con Caddy para un VPS. Tener Docker local no publica la aplicación en Internet. Después de disponer de servidor/dominio, verificar HTTPS, /api/health, /api/docs y Socket.IO desde otra red, e incorporar URLs reales aquí.

Pendientes del curso: publicación web/API, README con URLs verificadas y PDF con nombres/carnés confirmados, arquitectura, capturas reales y enlaces. No se inventan datos personales ni evidencia de producción.

## Frontend local

Desde apps/web: npm ci y npm run dev. Abrir http://localhost:3000 con la API Docker activa. Ver [documentación del frontend](apps/web/README.md) para rutas, sesión y pruebas de navegador.
