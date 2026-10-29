
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
    private readonly notifications: NotificationsService,
  ) {}

  async crearConversacion(usuarioId: string, destinatarioId: string) {
    if (usuarioId === destinatarioId) {
      throw new BadRequestException(
        'No puedes crear una conversación contigo mismo',
      );
    }

    const destinatario = await this.prisma.user.findUnique({
      where: { id: destinatarioId },
      select: { id: true },
    });

    if (!destinatario) {
      throw new NotFoundException('El usuario destinatario no existe');
    }

    const [starterId, receiverId] = [usuarioId, destinatarioId].sort();

    return this.prisma.conversation.upsert({
      where: {
        starterId_receiverId: {
          starterId,
          receiverId,
        },
      },
      create: {
        starterId,
        receiverId,
      },
      update: {},
    });
  }

  async misConversaciones(usuarioId: string) {
    return this.prisma.conversation.findMany({
      where: {
        OR: [
          { starterId: usuarioId },
          { receiverId: usuarioId },
        ],
      },
      include: {
        starter: {
          select: { id: true, username: true, displayName: true },
        },
        receiver: {
          select: { id: true, username: true, displayName: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async obtenerMensajes(usuarioId: string, conversacionId: string) {
    await this.verificarParticipante(usuarioId, conversacionId);

    return this.prisma.message.findMany({
      where: { conversationId: conversacionId },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
  }

  async enviarMensaje(
    usuarioId: string,
    conversacionId: string,
    contenido: string,
  ) {
    await this.verificarParticipante(usuarioId, conversacionId);

    const texto = contenido?.trim();

    if (!texto || texto.length > 2000) {
      throw new BadRequestException(
        'El mensaje debe contener entre 1 y 2000 caracteres',
      );
    }

    const mensaje = await this.prisma.message.create({
      data: {
        conversationId: conversacionId,
        senderId: usuarioId,
        content: texto,
      },
    });

    const conversacion = await this.prisma.conversation.update({
      where: { id: conversacionId },
      data: { updatedAt: new Date() },
    });

    const destinatarioId =
      conversacion.starterId === usuarioId
        ? conversacion.receiverId
        : conversacion.starterId;

    this.realtime.enviarAUsuario(
      destinatarioId,
      'chat:new',
      mensaje,
    );

    this.realtime.enviarAUsuario(
      usuarioId,
      'chat:new',
      mensaje,
    );

    // La entrega del mensaje no debe fallar si la notificacion tiene un problema.
    try {
      await this.notifications.notifyMessage(destinatarioId, usuarioId, mensaje.id);
    } catch {
      // El mensaje ya fue persistido y enviado por Socket.IO.
    }

    return mensaje;
  }

  private async verificarParticipante(
    usuarioId: string,
    conversacionId: string,
  ) {
    const conversacion = await this.prisma.conversation.findUnique({
      where: { id: conversacionId },
    });

    if (!conversacion) {
      throw new NotFoundException('Conversación no encontrada');
    }

    if (
      conversacion.starterId !== usuarioId &&
      conversacion.receiverId !== usuarioId
    ) {
      throw new ForbiddenException(
        'No tienes permiso para acceder a esta conversación',
      );
    }

    return conversacion;
  }
}
