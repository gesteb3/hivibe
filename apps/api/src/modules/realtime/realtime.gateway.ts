
import {
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';

type UsuarioConectado = {
  sub: string;
};

@Injectable()
@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL,
    credentials: true,
  },
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);
  private readonly conexiones = new Map<string, number>();

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token;

      if (typeof token !== 'string' || !token) {
        client.disconnect(true);
        return;
      }

      const usuario =
        await this.jwtService.verifyAsync<UsuarioConectado>(token);

      if (!usuario.sub || typeof usuario.sub !== 'string') {
        client.disconnect(true);
        return;
      }

      client.data.userId = usuario.sub;

      await client.join(`user:${usuario.sub}`);

      const conexionesPrevias = this.conexiones.get(usuario.sub) ?? 0;
      this.conexiones.set(usuario.sub, conexionesPrevias + 1);
      if (conexionesPrevias === 0) {
        this.server.emit('presence:update', { userId: usuario.sub, online: true });
      }

      this.logger.log('Usuario conectado al chat');
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId as string | undefined;
    if (!userId) return;

    const restantes = (this.conexiones.get(userId) ?? 1) - 1;
    if (restantes <= 0) {
      this.conexiones.delete(userId);
      this.server.emit('presence:update', { userId, online: false });
    } else {
      this.conexiones.set(userId, restantes);
    }
    this.logger.log('Usuario desconectado del chat');
  }

  enviarAUsuario(userId: string, evento: string, datos: unknown) {
    this.server.to(`user:${userId}`).emit(evento, datos);
  }
}
