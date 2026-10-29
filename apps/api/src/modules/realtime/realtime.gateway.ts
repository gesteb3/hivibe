import {
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../../database/prisma.service';

export const AUTHENTICATED_ROOM = 'authenticated';

@Injectable()
@WebSocketGateway()
export class RealtimeGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleDestroy
{
  @WebSocketServer() server!: Server;
  private readonly conexiones = new Map<string, number>();
  private readonly expiraciones = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  afterInit(server: Server) {
    server.use((client, next) => {
      void this.authenticate(client).then(
        () => next(),
        () => next(new Error('Token inválido o expirado')),
      );
    });
  }

  private async authenticate(client: Socket) {
    const token: unknown = client.handshake.auth?.token;
    if (typeof token !== 'string' || !token) throw new Error('Token requerido');
    const payload = await this.jwt.verifyAsync<{ sub?: unknown; exp?: number }>(
      token,
      { algorithms: ['HS256'] },
    );
    if (
      typeof payload.sub !== 'string' ||
      !payload.sub ||
      !Number.isFinite(payload.exp) ||
      payload.exp! * 1000 <= Date.now()
    )
      throw new Error('Token inválido');
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true },
    });
    if (!user) throw new Error('Usuario inexistente');
    client.data.userId = payload.sub;
    client.data.expiresAt = payload.exp! * 1000;
  }

  async handleConnection(client: Socket) {
    const userId = client.data.userId as string;
    const remaining = Number(client.data.expiresAt) - Date.now();
    if (!userId || remaining <= 0) {
      client.disconnect(true);
      return;
    }
    // Los JWT emitidos por esta API duran una hora. Limitar timers anómalos.
    const timer = setTimeout(
      () => client.disconnect(true),
      Math.min(remaining, 2_147_483_647),
    );
    timer.unref();
    this.expiraciones.set(client.id, timer);
    await client.join([AUTHENTICATED_ROOM, `user:${userId}`]);
    if (!client.connected) return;
    client.data.registeredPresence = true;
    const previous = this.conexiones.get(userId) ?? 0;
    this.conexiones.set(userId, previous + 1);
    client.emit('presence:snapshot', { userIds: [...this.conexiones.keys()] });
    if (previous === 0)
      this.broadcast('presence:update', { userId, online: true });
  }

  handleDisconnect(client: Socket) {
    clearTimeout(this.expiraciones.get(client.id));
    this.expiraciones.delete(client.id);
    if (!client.data.registeredPresence) return;
    const userId = client.data.userId as string;
    const remaining = (this.conexiones.get(userId) ?? 1) - 1;
    if (remaining <= 0) {
      this.conexiones.delete(userId);
      this.broadcast('presence:update', { userId, online: false });
    } else this.conexiones.set(userId, remaining);
  }

  onModuleDestroy() {
    for (const timer of this.expiraciones.values()) clearTimeout(timer);
    this.expiraciones.clear();
    this.conexiones.clear();
  }

  broadcast(event: string, data: unknown) {
    this.server.to(AUTHENTICATED_ROOM).emit(event, data);
  }
  enviarAUsuario(userId: string, event: string, data: unknown) {
    this.server.to(`user:${userId}`).emit(event, data);
  }
}
