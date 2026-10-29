import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { MessageHistoryQueryDto } from './dto/chat.dto';
import { AUTHOR_SELECT } from '../social/post.mapper';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
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
        OR: [{ starterId: usuarioId }, { receiverId: usuarioId }],
      },
      include: {
        starter: {
          select: AUTHOR_SELECT,
        },
        receiver: {
          select: AUTHOR_SELECT,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async obtenerMensajes(
    usuarioId: string,
    conversacionId: string,
    query: MessageHistoryQueryDto = new MessageHistoryQueryDto(),
  ) {
    await this.verificarParticipante(usuarioId, conversacionId);
    const before = query.before
      ? await this.prisma.message.findFirst({
          where: { id: query.before, conversationId: conversacionId },
          select: { id: true, createdAt: true },
        })
      : null;
    if (query.before && !before)
      throw new NotFoundException(
        'Cursor de mensaje no encontrado en esta conversación',
      );
    const messages = await this.prisma.message.findMany({
      where: {
        conversationId: conversacionId,
        ...(before
          ? {
              OR: [
                { createdAt: { lt: before.createdAt } },
                { createdAt: before.createdAt, id: { lt: before.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit,
    });
    return messages.reverse();
  }

  async enviarMensaje(
    usuarioId: string,
    conversacionId: string,
    contenido: string,
  ) {
    await this.verificarParticipante(usuarioId, conversacionId);

    const texto = typeof contenido === 'string' ? contenido.trim() : '';

    if (!texto || texto.length > 2000) {
      throw new BadRequestException(
        'El mensaje debe contener entre 1 y 2000 caracteres',
      );
    }

    const { mensaje, conversacion } = await this.prisma.$transaction(
      async (tx) => {
        const mensaje = await tx.message.create({
          data: {
            conversationId: conversacionId,
            senderId: usuarioId,
            content: texto,
          },
          include: { sender: { select: AUTHOR_SELECT } },
        });

        const conversacion = await tx.conversation.update({
          where: { id: conversacionId },
          data: { updatedAt: new Date() },
        });
        return { mensaje, conversacion };
      },
    );

    const destinatarioId =
      conversacion.starterId === usuarioId
        ? conversacion.receiverId
        : conversacion.starterId;

    this.realtime.enviarAUsuario(destinatarioId, 'chat:new', mensaje);

    this.realtime.enviarAUsuario(usuarioId, 'chat:new', mensaje);

    void this.unread(destinatarioId)
      .then((value) =>
        this.realtime.enviarAUsuario(destinatarioId, 'chat:unread', value),
      )
      .catch(() => {});

    return mensaje;
  }

  async unread(userId: string) {
    const rows = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM "Message" m JOIN "Conversation" c ON c.id=m."conversationId"
      WHERE (c."starterId"=${userId} OR c."receiverId"=${userId}) AND m."senderId"<>${userId}
      AND (CASE WHEN c."starterId"=${userId} THEN c."starterReadAt" ELSE c."receiverReadAt" END IS NULL
        OR m."createdAt" > CASE WHEN c."starterId"=${userId} THEN c."starterReadAt" ELSE c."receiverReadAt" END)
    `;
    return { count: Number(rows[0]?.count ?? 0) };
  }

  async markRead(userId: string, conversationId: string) {
    const conversation = await this.verificarParticipante(
      userId,
      conversationId,
    );
    if (conversation.starterId === userId) {
      await this.prisma
        .$executeRaw`UPDATE "Conversation" SET "starterReadAt"=clock_timestamp() WHERE id=${conversationId}`;
    } else {
      await this.prisma
        .$executeRaw`UPDATE "Conversation" SET "receiverReadAt"=clock_timestamp() WHERE id=${conversationId}`;
    }
    const unread = await this.unread(userId);
    this.realtime.enviarAUsuario(userId, 'chat:read', { conversationId });
    this.realtime.enviarAUsuario(userId, 'chat:unread', unread);
    return { conversationId, ...unread };
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
