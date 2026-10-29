
const { io } = require('socket.io-client');

const token = process.env.HIVIBE_TEST_TOKEN;

if (!token) {
  console.error('Falta HIVIBE_TEST_TOKEN');
  process.exit(1);
}

const socket = io('http://localhost:4300', {
  auth: { token },
  reconnection: true,
});

socket.on('connect', () => {
  console.log('Conexión Socket.IO establecida');
  console.log('Socket ID:', socket.id);
  console.log('Esperando mensajes en tiempo real...');
});

socket.on('chat:new', (mensaje) => {
  console.log('\nMENSAJE RECIBIDO EN TIEMPO REAL');
  console.log(JSON.stringify(mensaje, null, 2));
});

socket.on('connect_error', (error) => {
  console.error('Error de conexión:', error.message);
});

socket.on('disconnect', (reason) => {
  console.log('Conexión cerrada:', reason);
});
