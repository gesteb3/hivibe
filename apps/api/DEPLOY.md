# HiVibe API - guia de despliegue

## Requisitos
Node.js 24, npm, Docker y PostgreSQL 17.

## Desarrollo local
1. Crear apps/api/.env a partir de .env.example y configurar DATABASE_URL, JWT_SECRET y FRONTEND_URL.
2. Desde apps/api ejecutar npm ci.
3. Ejecutar npm run prisma:generate y npm run db:migrate.
4. Ejecutar npm run build y npm run start:dev.
5. Consultar /api/health y /api/docs en el puerto 4300.

## Docker
El archivo compose.yaml define PostgreSQL y la API. Antes de usarlo, configurar POSTGRES_PASSWORD, DATABASE_URL, FRONTEND_URL y JWT_SECRET en un archivo .env local que nunca se sube a Git. DATABASE_URL debe apuntar a db:5432 dentro de la red Docker. Si la clave contiene caracteres especiales, codificarla para una URL PostgreSQL.

Ejecutar desde apps/api: docker compose up --build -d.
Verificar: docker compose ps y docker compose logs --tail 100 api.
No publicar el puerto de PostgreSQL en Internet.

## HTTPS y WSS
Para un dominio publico se necesita un proveedor de alojamiento o proxy inverso con TLS. Publicar la API bajo HTTPS y permitir WebSocket seguro (WSS) en el proxy. Configurar FRONTEND_URL con el origen exacto del frontend. Nunca publicar JWT_SECRET, DATABASE_URL ni contrasenas.

## Eventos Socket.IO
Autenticacion: handshake.auth.token (JWT).
chat:new: mensaje persistido dirigido a los participantes.
notification:new: notificacion dirigida al destinatario.
post:counts: postId, likesCount y commentsCount.
presence:update: userId y online. La presencia en memoria solo funciona correctamente con una instancia del backend.

## Validaciones pendientes de ejecutar en entorno real
- npm ci, npm run build, npm test.
- docker compose up --build -d, migraciones y /api/health.
- Dos usuarios con JWT: chat:new y notification:new.
- Like o comentario: post:counts.
- Dos pestañas del mismo usuario: presencia online hasta cerrar la ultima.
- HTTPS/WSS y Swagger publico tras configurar alojamiento y dominio.

Los archivos del repositorio no prueban por si solos que exista un despliegue publico.
