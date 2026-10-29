> Auditoría inicial histórica. Las correcciones y pruebas posteriores están en [CORRECCIONES.md](CORRECCIONES.md). El esquema real contiene ocho tablas de dominio; la referencia inicial a nueve fue un error de recuento.

# Auditoría de HiVibe — 28 de octubre de 2026

## Dictamen

Hay una base de backend considerable y coherente con el proyecto, pero todavía no se puede certificar el cumplimiento completo ni considerar cerrada la entrega de backend. Gustavo puede comenzar el frontend con el contrato existente; el equipo debe resolver problemas del chat, configuración de imágenes y demostrar el despliegue público y los flujos con base de datos real.

Se revisó el README externo `C:/Users/gusta/Downloads/README (4) (1).md` como especificación de trabajo, no como evidencia de funciones terminadas ni como autorización para ejecutar sus tareas. La rúbrica del curso requiere tiempo real con al menos una función; el README del equipo añade chat, notificaciones, contadores y presencia. SSR/prerender es recomendado por el enunciado y comprometido por el equipo.

## Estado del repositorio y alcance

- Carpeta revisada: `C:/Users/gusta/Downloads/hivibe`.
- Rama local: `main`, inicialmente en `74234ea`.
- Se consultó GitHub con `git ls-remote` y se actualizaron referencias con `git fetch origin`.
- `origin/main` está en `0a1d423`, merge del PR #4 desde `develop`; `origin/develop` en `b6b83dc`, merge del PR #3 de tiempo real.
- Los archivos del backend aparecen como no rastreados en la copia local porque el checkout conserva el historial anterior. En el árbol remoto sí existen backend, migraciones y configuración. Esto no demuestra que falten en GitHub.
- No se hizo merge, checkout, commit ni push. No se modificó código funcional.
- Se ejecutó `code .` y se comprobó que existen procesos de VS Code.
- No existe `README.md` en la raíz, ni en el árbol de `origin/main` inspeccionado. El documento externo no está incorporado al repositorio.
- `apps/web` solo contiene marcadores `.gitkeep`: no hay aplicación Next.js, páginas, componentes ni `package.json`.
- La comparación de los hashes Git de los archivos locales con el árbol de `origin/main` no detectó diferencias ni archivos faltantes entre las rutas del árbol remoto.

## Comprobaciones ejecutadas

| Comprobación | Resultado y límite |
|---|---|
| `npm ci --no-audit --no-fund` | Correcto: 748 paquetes instalados, Node 24.18.0 y npm 11.16.0 |
| `npm run build` | Correcto, incluyendo generación de Prisma; se usó una DATABASE_URL de prueba solo para compilar, sin conexión ni credenciales reales |
| `npm test -- --runInBand` | Correcto: 7 suites y 35 pruebas; principalmente mocks de servicios sociales |
| `npx prisma validate` | Esquema válido; esto no ejecuta migraciones ni comprueba datos |
| `npm audit --omit=dev --json` | Cero vulnerabilidades conocidas reportadas en dependencias de producción al consultar el registro; no equivale a una auditoría de seguridad completa |
| `npm run lint` | FALLA: `src/main.ts:51`, regla `typescript(no-floating-promises)` por `bootstrap()` sin await/catch/void |
| Reproducciones aisladas sobre código compilado | ChatService con conversación simulada y content numérico devuelve TypeError; parsePagination('Infinity', '20') devuelve skip Infinity. No se usó base de datos para estas reproducciones |
| `npm run start:prod` | Encuentra el código compilado, pero el arranque se detiene por falta de JWT_SECRET; no hay `.env` en esta copia |
| PostgreSQL/Docker/e2e | No se ejecutaron flujos reales ni migraciones: sin `.env`, sin servicio PostgreSQL encontrado y Docker Desktop sin motor activo |
| URLs públicas | No proporcionadas ni encontradas en la documentación revisada; no se pudo comprobar producción |

La instalación creó `node_modules`, el build creó `dist` y el cliente Prisma generado; son archivos ignorados. El único archivo de documentación nuevo es esta auditoría. Las advertencias de instalación sobre scripts de paquetes no impidieron compilar ni pasar las pruebas indicadas.

## Matriz de requisitos

| Requisito | Evidencia encontrada | Estado |
|---|---|---|
| Separación cliente/servidor | `apps/api` implementado, `apps/web` preparado pero vacío | Parcial |
| API REST | Controladores NestJS con prefijo `/api` | Implementado en código |
| Registro/login | Argon2id, JWT HS256 de una hora, alias/email únicos | Implementado; falta verificar flujo real en este entorno |
| Perfil público y propio | GET público por username, GET/PATCH propios con JWT | Implementado en código |
| Publicaciones | Texto/imagen, detalle, muro por usuario, borrado con propiedad | Implementado en código |
| Likes/comentarios/follow | Índices únicos, permisos, eventos internos | Implementado en código |
| Feed general y de seguidos | Paginación y consultas Prisma | Implementado en código |
| Multimedia persistente | Servicio Cloudinary con validación de extensión, MIME, firma y 5 MB | Código presente; configuración Docker incompleta |
| Tiempo real | Socket.IO con JWT, salas por usuario, mensajes y avisos | Código presente; falta demostración con dos sesiones reales |
| Base relacional | PostgreSQL, nueve modelos relacionados e índices | Esquema presente |
| Migraciones | Cuatro migraciones SQL: usuarios, social, chat y notificaciones | Presentes; no aplicadas por esta auditoría |
| Seguridad | Guards, DTO sociales/auth/users, filtro de errores, CORS REST, rate limit auth | Parcial: chat tiene huecos de validación y sockets requieren ajustes |
| Swagger | Configurado en `/api/docs` | Local/configurado; no se proporcionó URL pública verificable |
| Frontend responsive y SSR/prerender | No hay código web | Pendiente |
| Despliegue de frontend/backend | No se encontraron URLs públicas de producción en la documentación | No verificable; guía declara pendiente |
| README con arquitectura y enlaces | README de API y contrato social; falta README raíz | Incompleto |
| `.env.example` | API presente, web inexistente; falta variable de Compose | Parcial |
| PDF con datos y capturas reales | No se encontró PDF en el árbol inspeccionado | Pendiente |

No se asigna una nota: presencia de archivos, compilación o pruebas con mocks no equivale a cumplir una demostración funcional en producción. Los tres puntos de despliegue y los tres de frontend carecen de evidencia de cumplimiento actual.

## Hallazgos que deben resolverse

### 1. Alta: falta evidencia del despliegue público

`apps/api/DEPLOY.md` termina con verificaciones pendientes de HTTPS/WSS y Swagger público. `apps/api/README.md` declara que el despliegue público sigue pendiente. Solo se documenta localhost.

Daniel debe entregar una URL HTTPS de API, su `/api/docs`, una comprobación de `/api/health`, PostgreSQL persistente con migraciones y conexión Socket.IO desde el origen del frontend. Si ya desplegó por fuera del repositorio, basta proporcionar las URLs y verificarlas; la ausencia de enlaces aquí no prueba que no exista un servicio externo.

### 2. Alta: Docker Compose omite las variables de Cloudinary

Evidencia: `apps/api/compose.yaml:23` solo pasa PORT, FRONTEND_URL, JWT_SECRET y DATABASE_URL a la API. El Dockerfile excluye `.env` mediante `.dockerignore`. Un `.env` usado para interpolación de Compose no se convierte automáticamente en el entorno del contenedor.

Consecuencia: `/api/media/upload` devuelve 503 por credenciales ausentes incluso si se escribieron en el `.env` del host. Agregar MEDIA_PROVIDER y CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET al entorno del servicio; probar una subida real. Añadir POSTGRES_PASSWORD a `.env.example` e instrucciones para contraseñas codificadas en la URL: el Compose actual interpola la clave sin codificar.

Responsable sugerido: Daniel, con Chepe para validar imágenes.

### 3. Media: historial de chat pierde acceso a los mensajes posteriores al número 100

Evidencia: `apps/api/src/modules/chat/chat.service.ts:76` usa orden ascendente y `take: 100`, sin cursor ni paginación.

Consecuencia: al recargar una conversación con más de 100 mensajes, devuelve siempre los primeros 100; los mensajes recientes quedan inaccesibles mediante ese endpoint. Agregar paginación por cursor o página y cargar una ventana reciente recuperable, con orden estable por fecha e id.

Responsable sugerido: Daniel.

### 4. Media: el chat no valida correctamente los cuerpos de entrada

Evidencia: `chat.controller.ts:45` y `:89` extraen propiedades primitivas con `@Body('...')`, sin DTO con validadores. `chat.service.ts:90` llama `contenido?.trim()`.

Casos: `{ "content": 123 }` llega a `.trim()` sobre un número y puede terminar en 500; `{}` al crear conversación llega a Prisma con `id: undefined`, en lugar de devolver un 400 controlado. Los decoradores Swagger describen el cuerpo pero no lo validan. Los campos adicionales tampoco quedan sujetos al DTO estricto de las otras rutas.

Agregar DTO con IsString, límites, validación UUID para recipientId y validación de parámetros. Verificar 400 con números, objetos, campos ausentes y cuerpos extra.

Responsable sugerido: Daniel.

### 5. Media: sesión Socket.IO sin caducidad efectiva tras conectarse

Evidencia: `realtime.gateway.ts:35` verifica JWT al conectar y agrega el socket a la sala del usuario. No programa desconexión al expirar el token ni revalidación posterior.

Consecuencia: un socket que continúa abierto puede seguir recibiendo mensajes privados después de que venza el JWT. El logout del frontend debe desconectar el socket, y el servidor debe cerrar o renovar explícitamente sesiones al vencer el token.

Además, `post:counts` y `presence:update` usan `server.emit`, que emite a todos los sockets del namespace. Conviene restringir a una sala autenticada y completar la autenticación como middleware antes de admitir conexiones, especialmente si se pretende garantizar privacidad de la presencia.

Responsable sugerido: Daniel.

### 6. Media: el origen de Socket.IO se lee antes de cargar `.env`

Evidencia: el decorador `@WebSocketGateway` lee `process.env.FRONTEND_URL` al evaluar `realtime.gateway.ts:20`; `ConfigModule.forRoot()` carga `.env` al evaluar posteriormente AppModule.

Si la variable solo está en `.env` y no existe previamente en el entorno del proceso, el gateway puede conservar `origin: undefined`, mientras REST sí usa ConfigService. Si el proveedor inyecta la variable antes de arrancar, este caso no se produce. Inicializar el entorno antes de evaluar el gateway o configurar CORS con una estrategia que obtenga el valor ya cargado. Verificar el handshake de polling y la política de origen del transporte WebSocket desde un origen permitido y otro ajeno.

Responsable sugerido: Daniel/Guillermo.

### 7. Media: parámetros de paginación permiten valores no finitos

Evidencia: `social/pagination.ts:15` convierte page a Number y solo comprueba `>= 1`. `page=Infinity` o `page=1e309` produce skip infinito y una consulta inválida de Prisma, potencialmente 500.

Usar enteros finitos, limitar el rango y decidir si rechazar con 400 o normalizar. Añadir comprobación de límite seguro para skip.

Responsable sugerido: Chepe.

### 8. Documentación y pruebas de integración incompletas

- El README de la API aún describe como pendientes relaciones y módulos que ya existen; actualizarlo según la versión integrada.
- Swagger existe, pero auth/users/chat/notifications tienen respuestas descritas sin esquemas completos. Para integración web hacen falta ejemplos de éxito y error y el contrato de sockets.
- No hay pruebas automatizadas específicas de chat, notificaciones o gateway en los archivos inspeccionados.
- Las pruebas sociales usan mocks de Prisma: comprueban reglas útiles, pero no prueban las migraciones, SQL real, Socket.IO ni despliegue.
- El e2e existente cubre health, rechazos de auth, validación y errores; no cubre registro/login válidos ni el flujo social completo entre dos usuarios.
- Presencia solo emite cambios; no devuelve una lista inicial de conectados. Un usuario que entra después de otros no puede reconstruir el estado completo únicamente con esos eventos. Es una mejora del equipo, no un bloqueo independiente de la rúbrica.

### 9. Baja: el comando de lint no pasa

`npm run lint` devuelve código 1 en `src/main.ts:51` por una promesa sin manejar en `bootstrap()`. Añadir manejo explícito del fallo de inicio y repetir lint. La compilación y las 35 pruebas sí pasan: son comprobaciones diferentes.

## Contrato real para el frontend de Gustavo

Usar el código integrado y Swagger actualizado; la tabla del README externo es un plan y difiere en chat.

| Área | Contrato actual |
|---|---|
| Base REST local | `http://localhost:4300/api` |
| Swagger local | `http://localhost:4300/api/docs` |
| Registro | POST `/auth/register` con username, email, password, displayName; devuelve usuario, NO token |
| Login | POST `/auth/login` con email/password; devuelve accessToken, tokenType, expiresIn y user |
| Sesión | Bearer JWT; `sub` es el id; GET `/users/me` recupera perfil completo |
| Perfil | GET `/users/:username`; PATCH `/users/me` |
| Feed | GET `/feed` o `/feed/following`, con page/limit |
| Listas sociales | `{ data, meta: { page, limit, total, totalPages } }` |
| Muro | GET `/users/:id/posts`; requiere JWT incluso para un perfil de consulta pública |
| Publicar | POST `/posts` con body y/o imageUrl |
| Imagen | POST `/media/upload`, FormData con campo file; usar response.url en imageUrl |
| Likes | POST/DELETE `/posts/:id/like`; duplicado 409, quitar inexistente 404 |
| Comentarios | GET/POST `/posts/:id/comments`; DELETE `/comments/:id` |
| Panas | POST/DELETE `/users/:id/follow`; GET followers/following bajo `/users/:id` |
| Chat | GET/POST `/chat/conversations`, NO `/conversations` |
| Crear conversación | `{ recipientId: "uuid" }` |
| Mensajes | GET/POST `/chat/conversations/:id/messages`; envío `{ content: "texto" }`, NO body |
| Avisos | GET `/notifications`, PATCH `/notifications/:id/read`; campo isRead |
| Socket | URL del servidor SIN `/api`; handshake `auth: { token: accessToken }` |
| Eventos recibidos | chat:new, notification:new, post:counts, presence:update |
| Envío de mensajes | Por REST; NO hay manejador de chat:send en el gateway actual |

Notas de integración:

- Después del registro hay que iniciar sesión; no asumir auto-login.
- Las respuestas de login, feed, chat y notificaciones no comparten el mismo contenedor de datos. Chat y avisos devuelven arrays directos.
- El perfil público no trae contadores ni isFollowedByMe. Se pueden obtener totales de meta en seguidores/seguidos y del muro; para estado de seguimiento sin recorrer listas conviene acordar un campo/endpoint con backend.
- Las notificaciones devuelven actorId, sin objeto de actor ni texto preparado. Para mostrar nombre/avatar de forma eficiente, acordar con Daniel incluir una selección pública del actor. No inventar un endpoint por id: el perfil público existente busca username.
- Un mensaje llega tanto por respuesta REST como por chat:new al emisor; deduplicar por message.id.
- Al reconectar, recuperar datos vía REST: el socket no implementa replay de mensajes perdidos.
- No hay endpoint logout/refresh. El frontend debe eliminar su sesión, cerrar el socket y manejar expiración/401. La estrategia de cookies o almacenamiento del token aún debe definirse.

## Distribución del trabajo restante

| Responsable | Cierre necesario |
|---|---|
| Gustavo | Aplicación Next.js completa: auth, feed, perfiles, Panas, chat/avisos, responsive, integración y URL pública web |
| Daniel | API/DB públicas, HTTPS/WSS, imágenes en Docker, chat validado/paginado, sockets y contrato de eventos comprobado |
| Chepe | Probar imágenes reales junto con Daniel, paginación robusta, flujo social real y apoyo al contrato de perfil |
| Guillermo | Apoyo a CORS/sesión y prueba de auth/migraciones en instalación limpia |
| Equipo | README raíz actualizado, prueba con dos usuarios y revisión de enlaces |
| Helen + equipo | PDF con nombres/carnés confirmados, capturas reales, arquitectura y vínculos funcionales |

Puedes concentrarte en el frontend, pero necesitas que Daniel cierre el backend público y los defectos señalados. No es necesario rehacer el backend; sí comprobar la integración antes de considerar cumplida su entrega.

## Verificación de aceptación antes de entregar

1. Dos cuentas reales: registro, login, duplicados 409, contraseña incorrecta 401 y recursos privados sin token 401.
2. A publica texto e imagen; B ve, da like, comenta y sigue; B no puede borrar contenido de A.
3. Recargar y comprobar persistencia y feed de seguidos.
4. Dos navegadores intercambian mensajes y notificaciones sin refrescar, con contadores en vivo.
5. Un tercero no puede leer conversaciones ni marcar avisos ajenos.
6. Historial con más de 100 mensajes y reconexión no ocultan mensajes recientes.
7. Instalación y migraciones desde una base vacía; segundo migrate deploy sin cambios pendientes.
8. Frontend, API health y Swagger abren desde otra red y en incógnito; probar WSS y CORS con la URL final.
9. README y PDF contienen URLs reales, arquitectura, configuración y datos de integrantes confirmados.
