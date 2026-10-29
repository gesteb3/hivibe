# HiVibe Web

Frontend Next.js 16, React 19, TypeScript y Socket.IO. Identidad propia inspirada en perfiles de los 2000: lila, estrellas, paneles compactos y tipografía de sistema, sin recursos ni logos de Hi5.

## Ejecutar

Con la API de apps/api activa en Docker:
```powershell
cd apps/web
npm ci
npm run dev
```

Abrir http://localhost:3000. Para probar versión de producción: npm run build y npm start (detener antes el servidor de desarrollo para liberar el puerto).

## Configuración

Las URLs locales de .env.example funcionan por defecto. Para otro backend crear .env.local y configurar:
- API_URL: URL REST del backend incluyendo /api. Solo la usa el servidor Next.
- NEXT_PUBLIC_SOCKET_URL: URL HTTPS pública del backend sin /api, usada por el navegador.

No colocar secretos en variables NEXT_PUBLIC_. En producción configurar FRONTEND_URL de la API con el origen exacto del frontend. Para publicar en Vercel seleccionar apps/web como Root Directory y configurar las dos URLs antes de compilar. No se ha publicado una URL pública en esta sesión.

## Funcionalidades

- Bienvenida y formularios prerenderizados.
- Registro, login real y cierre de sesión.
- Feed general y de seguidos, publicaciones texto/foto, likes, comentarios y borrado propio.
- Perfil con avatar, portada, bio, estado corto (80 caracteres), contadores y edición; perfil público con SSR para visitantes. Cuatro temas persistentes (classic/ocean/rose/forest) cambian colores, fondo y bordes para todos los visitantes.
- Cuates: buscar alias exacto, seguir/dejar de seguir, seguidores y seguidos.
- Chat privado persistente con historial por cursor, deduplicación y reconexión.
- Notificaciones sociales con lectura, contador dedicado y enlace al post/comentario/respuesta o perfil. No incluyen mensajes, tampoco los históricos.
- Avisos de mensajes independientes, cerrables y de 10 segundos; punto de Mensajes persistente hasta leer la conversación visible.
- Comentarios con respuestas de un nivel, Nitido individual y paginación; enlaces directos abren y enfocan el comentario solicitado.
- Vistas móviles, navegación por teclado, estados de carga/error/vacío y confirmación inline al borrar.

Rutas: /, /registro, /login, /feed, /perfil/:username, /cuates, /mensajes y /notificaciones. /panas redirige a /cuates por compatibilidad.

## Sesión y conexión

REST pasa por un BFF de Next en /api/backend/*. El JWT vive en cookie HttpOnly, SameSite=Lax y Secure en producción; no se guarda en localStorage. El proxy valida origen en mutaciones y añade Authorization únicamente hacia la API configurada.

Socket.IO necesita el token en memoria: /api/socket-token lo entrega a la sesión del mismo sitio, con Cache-Control no-store; el navegador no lo persiste. La API verifica y expira sockets. Cerrar sesión desconecta el socket y borra la cookie. No existe renovación automática de JWT en este backend: al vencer se vuelve a login.

Las listas no usan datos inventados. La vista ilustrativa de bienvenida es una composición decorativa de un posible perfil, no cuentas ni estadísticas reales.

## Verificar

```powershell
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
npm audit --omit=dev
```

E2E requiere apps/api/node_modules y su .env, PostgreSQL y API local en4300. Crea dos cuentas efímeras, comprueba flujo social, imágenes, interacción y chat real, perfil SSR sin JS, cookie HttpOnly, rechazo de logout cross-site y ausencia de desbordamiento móvil. Limpia solo sus cuentas por IDs. El límite de auth es 5 solicitudes/minuto por ruta: esperar un minuto entre varias repeticiones seguidas.

PLAYWRIGHT_SERVER_COMMAND="npm run start" permite ejecutar los mismos tests contra build de producción. El servidor en3000 ya activo se reutiliza.

## Etapas Git

1. Identidad visual, bienvenida y estructura Next.
2. Registro y sesión segura con backend real.
3. Feed, publicaciones, perfiles y seguimiento.
4. Chat, presencia y notificaciones.
5. Ajustes visuales, perfiles públicos y vocabulario Cuates.
6. Pruebas de navegador, CI y documentación.

Pendiente externo: cuentas gratuitas/configuración de hosting, URLs públicas frontend/API y documento PDF de entrega.

## Verificación de funciones nuevas

`tests/features.spec.ts` prueba dos cuentas: persistencia de estado/tema en perfil propio, ajeno y público sin JavaScript; rechazo de valores no admitidos; respuesta y Nitido en comentarios; notificaciones con enlace exacto y recarga; aviso de mensaje de 10 segundos, cierre manual y lectura persistente sin generar avisos en la campana. La franja de alias encima de la portada fue eliminada.

La migración `20261029080000_profile_comments_unread` añade los campos y relaciones necesarios. Aplicar con `npm run db:migrate` en API, o reconstruir Compose (migra al iniciar). No eliminar volúmenes.
