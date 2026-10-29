# HiVibe — API de autenticación y usuarios

Backend desarrollado con NestJS, TypeScript, PostgreSQL y Prisma.

## Funciones implementadas

- Registro con username y correo únicos.
- Contraseñas protegidas mediante Argon2id.
- Login con JWT Bearer y expiración de una hora.
- Consulta y edición del perfil propio.
- Consulta de perfiles públicos sin exponer correo ni contraseña.
- Validación de datos y rechazo de campos adicionales.
- Límite de peticiones en registro y login.
- Filtro global de errores.
- Documentación Swagger.

## Requisitos

- Node.js y npm.
- PostgreSQL activo.
- Base de datos `hivibe`.

El desarrollo local se verificó con Node.js 24.18.1,
PostgreSQL 17 y Prisma 7.10.1.

## Instalación

Desde la raíz del repositorio:

```powershell
cd apps/api
npm ci
```

Crear el archivo de configuración:

```powershell
Copy-Item .env.example .env
```

Editar `.env` con los valores del entorno:

```dotenv
PORT=4300
FRONTEND_URL=http://localhost:3000
DATABASE_URL="postgresql://postgres:CAMBIAR_PASSWORD@localhost:5433/hivibe?schema=public"
JWT_SECRET=REEMPLAZAR_CON_UN_SECRETO_ALEATORIO
```

El puerto local de PostgreSQL utilizado es `5433`.
Ajustarlo si la instalación utiliza otro.

`FRONTEND_URL` debe coincidir con el origen real del frontend.
No inicia el frontend ni reserva un puerto.

Para generar el secreto JWT:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

No subir `.env`, contraseñas, secretos ni tokens al repositorio.
Los caracteres especiales de la contraseña deben codificarse
correctamente dentro de la URL de conexión.

## Base de datos

Aplicar las migraciones existentes:

```powershell
npm run db:migrate
```

Generar el cliente Prisma:

```powershell
npm run prisma:generate
```

Para crear una nueva migración durante el desarrollo:

```powershell
npx prisma migrate dev --name nombre_del_cambio
```

Las migraciones SQL se guardan en `prisma/migrations`.
No borrar migraciones aplicadas ni editar archivos generados.

## Ejecución local

```powershell
npm run start:dev
```

Este comando genera el cliente Prisma antes de iniciar NestJS.

Direcciones locales:

- API: http://localhost:4300/api
- Healthcheck: http://localhost:4300/api/health
- Swagger: http://localhost:4300/api/docs

Estas direcciones requieren que el backend esté ejecutándose
y no son enlaces públicos de despliegue.

## Endpoints

| Método | Ruta | Autenticación |
|---|---|---|
| GET | `/api/health` | Pública |
| POST | `/api/auth/register` | Pública |
| POST | `/api/auth/login` | Pública |
| GET | `/api/users/me` | JWT |
| PATCH | `/api/users/me` | JWT |
| GET | `/api/users/:username` | Pública |

### Registro

```json
{
  "username": "nuevo_pana",
  "email": "nuevo@example.com",
  "password": "PruebaLocal2026!",
  "displayName": "Nuevo Pana"
}
```

Las contraseñas del ejemplo son exclusivamente para pruebas locales.

### Login

```json
{
  "email": "nuevo@example.com",
  "password": "PruebaLocal2026!"
}
```

La respuesta contiene:

- `accessToken`: token JWT.
- `tokenType`: `Bearer`.
- `expiresIn`: `3600` segundos.
- `user`: datos básicos del usuario.

El identificador del usuario se encuentra en `sub` dentro del JWT.

### Rutas privadas

Enviar el encabezado:

```text
Authorization: Bearer TOKEN
```

En Swagger, pulsar `Authorize` y pegar únicamente el token,
sin comillas y sin escribir `Bearer`.

### Editar perfil

```json
{
  "displayName": "Mi perfil HiVibe",
  "bio": "Conociendo nuevos Panas."
}
```

También se admiten `avatarUrl` y `coverUrl` con URLs HTTPS.
El backend guarda estas URLs; este módulo no implementa
la subida de archivos.

La identidad del perfil a editar se obtiene del token.
No se admite un campo `id` en el cuerpo de la petición.

## Seguridad y errores

- Hash Argon2id; las respuestas no incluyen `passwordHash`.
- JWT firmado con HS256 y expiración de una hora.
- CORS limitado al origen configurado.
- Registro y login: 5 peticiones por minuto, por IP y ruta.
- El límite incluye peticiones exitosas y fallidas.
- El contador actual se mantiene en memoria del proceso.
- Los errores internos no exponen stacktraces en la respuesta.

Códigos principales:

| Código | Significado |
|---|---|
| 400 | Datos inválidos o campos no permitidos |
| 401 | Autenticación requerida o inválida |
| 404 | Ruta o usuario no encontrado |
| 409 | Alias o correo duplicado |
| 429 | Límite de peticiones excedido |
| 500 | Error interno |

## Compilación y pruebas

```powershell
npm run build
npm test -- --runInBand
npm run test:e2e -- --runInBand
npm audit
```

La compilación genera automáticamente el cliente Prisma.

Las pruebas e2e requieren PostgreSQL y `.env` configurados.
Actualmente verifican healthcheck, acceso sin token,
token inválido, protección de edición, validación del registro
y formato de errores.

El registro, login y edición con credenciales válidas también
se comprobaron manualmente.

## Dependencias

Multer está fijado mediante `overrides` a la versión `2.5.0`
para corregir la vulnerabilidad detectada en la versión anterior.

No ejecutar actualizaciones forzadas sin revisar compatibilidad
y repetir las pruebas.

## Verificación de migraciones

Se aplicó la migración `20261026042217_init_users` sobre la base
vacía `hivibe_migration_test` mediante `prisma migrate deploy`.

La primera ejecución creó las tablas correctamente.
La segunda respondió `No pending migrations to apply`,
confirmando que no vuelve a ejecutar migraciones ya aplicadas.

La base principal `hivibe` no fue modificada durante esta prueba.


## Prueba de recuperación mediante respaldo

Se creó un respaldo Custom de `hivibe_migration_test` con pgAdmin
y se restauró en una base independiente: `hivibe_restore_test`.

Se comprobó la recuperación de la tabla `User` y del historial
`_prisma_migrations`. La base principal `hivibe` no fue modificada.

Este procedimiento recupera el estado del respaldo; no ejecuta
una migración inversa. Los cambios posteriores al respaldo
requieren una estrategia adicional de recuperación.


## Ejecución del código compilado

Con `.env` configurado y PostgreSQL activo:

```powershell
npm run build
npm run start:prod
```

Se verificó el arranque, el healthcheck y Swagger en el puerto 4300.

Detener el servidor de desarrollo antes de iniciar el de producción
para evitar `EADDRINUSE`.

Esta prueba es local; el despliegue público sigue pendiente.

## Alcance pendiente de integración

- Acordar y ampliar las relaciones del esquema para los módulos sociales
  y de tiempo real.
- Documentar y probar recuperación o reversión de migraciones.
- Completar esquemas de respuesta y ejemplos en Swagger.
- Coordinar el comportamiento de cierre de sesión con el frontend.
- Completar pruebas entre dos usuarios con identidades distintas.
- Integrar mediante PR hacia `develop`.
- Verificar instalación limpia.

Los módulos de publicaciones, interacciones, chat, notificaciones,
frontend y despliegue corresponden a las otras áreas del equipo.