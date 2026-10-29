
const { io } = require('socket.io-client');

const token = process.env.HIVIBE_TEST_TOKEN;

if (!token) {
  console.error('Falta el token del usuario.');
  process.exit(1);
}

const socket = io('http://localhost:4300', {
  auth: { token },
  reconnection: true,
  reconnectionDelay: 1000,
  transports: ['websocket'],
});

socket.on('connect', () => {
  console.log('================================');
  console.log('CONECTADO A HIVIBE');
  console.log('Socket ID:', socket.id);
  console.log('Esperando notificaciones...');
  console.log('================================');
});

socket.on('notification:new', (notificacion) => {
  console.log('\n================================');
  console.log('NUEVA NOTIFICACION EN TIEMPO REAL');
  console.log('================================');

  console.log(JSON.stringify(notificacion, null, 2));
});

socket.on('post:counts', (datos) => {
  console.log('\nCONTADORES ACTUALIZADOS');
  console.log(JSON.stringify(datos, null, 2));
});

socket.on('connect_error', (error) => {
  console.error('Error de conexion:', error.message);
});

socket.on('disconnect', (reason) => {
  console.log('Conexion cerrada:', reason);
});

process.on('SIGINT', () => {
  socket.disconnect();
  process.exit(0);
});
