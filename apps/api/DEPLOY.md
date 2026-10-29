# Despliegue de HiVibe API

## Local verificado

Desde apps/api:

```powershell
npm ci
npm run setup:local
docker compose up -d --build --wait
docker compose ps
```

Configurar secretos en .env, nunca en Git. La base y las imágenes usan volúmenes persistentes. Los puertos 4300 y 5433 se exponen solo en loopback. La API aplica prisma migrate deploy al iniciar y ofrece /api/health y /api/docs.

## VPS con dominio y HTTPS

Esta configuración está preparada; no representa un despliegue público ya realizado.

1. Disponer de un VPS con Docker/Compose y dominio cuyo DNS apunte al servidor. Abrir 80/443 en su firewall.
2. Copiar/clonar el repositorio, ejecutar npm run setup:local para generar configuración (o crear .env desde .env.example con secretos propios).
3. En .env fijar API_DOMAIN al hostname real, FRONTEND_URL al origen HTTPS real del frontend, MEDIA_PUBLIC_URL a https://HOSTNAME_REAL/media. Mantener DOCKER_DATABASE_URL apuntando a db:5432, con contraseña codificada.
4. Iniciar desde apps/api:
```bash
docker compose -f compose.yaml -f compose.production.yaml up -d --build --wait
```
5. Caddy publica el proxy 80/443; la API y BD siguen en loopback. Verificar certificados, /api/health, /api/docs, /api/docs-json, imágenes y Socket.IO con dos cuentas desde otra red.
6. Registrar las URLs REALES en README y PDF. El frontend se publica por separado cuando exista.

[Caddy automatiza certificados públicos cuando DNS y puertos están configurados](https://caddyserver.com/docs/automatic-https); [reverse_proxy soporta WebSockets](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy). El proxy opcional no se inicia en el entorno local normal.

Para Cloudinary: MEDIA_PROVIDER=cloudinary y CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET. Compose pasa esas variables; el frontend solo recibe URLs. Con imágenes locales se necesita un disco persistente y respaldos del volumen, además de PostgreSQL. Un PaaS con disco efímero requiere Cloudinary u otro almacenamiento persistente.

## Operación

Detener sin borrar datos: docker compose down. No eliminar volúmenes para actualizar. Para actualizar código: reconstruir API; las migraciones ya aplicadas no se repiten. Antes de cambios de esquema, respaldar PostgreSQL con pg_dump y conservar una copia de imágenes fuera del servidor. Ensayar restauración en una base aislada.

El rate limit y presencia están en memoria y son de una instancia. En proxy, la API conserva la IP del proxy como clave del rate limit: es conservador y compartido entre usuarios. Para límites por usuario/IP pública, configurar trust proxy únicamente para el proxy real, junto con almacenamiento compartido si se escala; no confiar indiscriminadamente en X-Forwarded-For.

No hay cuentas de alojamiento ni dominio configurados en esta sesión. Publicación frontend/API y PDF siguen pendientes.
