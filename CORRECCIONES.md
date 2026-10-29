# Cierre de auditoría — 29 de octubre de 2026

## Resultado

Backend funcionando localmente en Docker, con PostgreSQL y archivos persistentes, sin modificar la aplicación frontend. La auditoría inicial se conserva en AUDITORIA.md como evidencia histórica.

## Hallazgos corregidos

| Hallazgo | Solución |
|---|---|
| Credenciales de imágenes ausentes en Compose | Todas las CLOUDINARY_* se pasan al servicio. Se añadió proveedor local con volumen persistente para no depender de una cuenta cloud |
| Historial limitado a primeros 100 | Ventana reciente y cursor before, orden estable por fecha/id, recuperación completa |
| Chat devuelve 500 con entrada inválida | DTO de cuerpo/consulta, UUID de parámetros, límite y trim seguro; ahora devuelve 400 |
| JWT de socket caduca sin desconectar | Autenticación antes de aceptar, HS256, usuario existente y desconexión programada al expirar |
| Eventos globales a sockets sin autenticar | Sala autenticada para presencia/contadores; salas privadas para mensajes y avisos |
| CORS Socket.IO leído antes de .env | Adaptador obtiene ConfigService al configurar servidor; valida origen en polling y WebSocket |
| Paginación infinita | Normalización de enteros finitos y offsets acotados |
| Falta de estado inicial de presencia | presence:snapshot, manteniendo contador por pestañas |
| Perfil/avisos insuficientes para frontend | Contadores de perfil, endpoint relationship y actor público incluido en avisos |
| Swagger incompleto | DTO de respuestas auth, perfiles, chat y avisos; contrato REST/socket documentado |
| Lint falla | Arranque con manejo de rechazo; lint limpio |
| Falta README raíz | README raíz, API, despliegue, ejemplos y límites actualizados |
| Pruebas solo con mocks | Pruebas reales con tres cuentas, PostgreSQL, Socket.IO, archivos y reinicio de contenedor |

Los mensajes y la fecha de conversación se guardan en una transacción antes de emitir eventos. El contenedor final usa uid 1000 (node), no incluye .env, Jest ni deepmerge; la base y la API se publican únicamente en loopback. Se genera un .env con secretos aleatorios que Git ignora.

## Evidencia ejecutada

- Build local y build multietapa Docker correctos.
- Lint sin errores ni advertencias.
- 45 pruebas unitarias en 9 suites.
- 6 pruebas e2e del arranque y rutas protegidas.
- 12 escenarios de integración real aprobados (Node muestra 13 pruebas incluyendo el grupo).
- Cuatro migraciones en base vacía aislada, ocho tablas de dominio y segunda aplicación sin pendientes.
- Imagen real subida y consultada; archivo falso rechazado 400, archivo mayor de 5 MB rechazado 413.
- Chat, avisos, contadores y presencia comprobados con tres clientes y ambos transportes; tercero sin acceso al chat privado.
- Historial con 106 mensajes recuperado completamente en ventanas por cursor.
- Mensajes, publicaciones e imagen accesibles después de reiniciar API.
- Auditoría de dependencias de producción sin vulnerabilidades conocidas reportadas.

El audit completo informa seis alertas bajas transitivas de Jest/deepmerge en desarrollo. El [advisory](https://github.com/advisories/GHSA-gcqx-w48m-w2h4) declara que no hay versión corregida. No se hizo downgrade forzado; esas dependencias no están en la imagen final de ejecución.

## Uso

Desde apps/api, Docker activo:
```powershell
docker compose up -d --build --wait
```

- API health: http://localhost:4300/api/health
- Swagger: http://localhost:4300/api/docs
- OpenAPI: http://localhost:4300/api/docs-json
- BD local: 127.0.0.1:5433; credenciales privadas en .env.

Para repetir pruebas usar los comandos de README.md. test:integration reinicia api y elimina sus cuentas de prueba. No usarlo contra un entorno de usuarios reales.

## Pendientes externos al cierre de código

1. Frontend: sigue vacío por indicación de Gustavo.
2. Publicación en Internet: no existen cuentas/servidor/dominio configurados. Se dejó Compose opcional con Caddy para VPS, sin activarlo localmente.
3. URLs públicas verificadas y PDF con nombres/carnés y capturas del sistema completo.
4. Para producción: respaldos del volumen de imágenes y PostgreSQL. Para varias instancias, estado compartido de presencia, rate limit y Socket.IO.

Las direcciones localhost no cumplen por sí solas los puntos de despliegue del curso. No se generó un PDF con datos ni capturas ficticias.
