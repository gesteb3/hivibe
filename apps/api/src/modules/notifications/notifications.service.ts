
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../database/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { SOCIAL_EVENTS } from '../social/social.events';

import type {
  LikeEvent,
  CommentEvent,
  FollowEvent,
  CountsEvent,
} from '../social/social.events';
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  private async createNotification(
    userId: string,
    actorId: string,
    type: string,
    postId?: string,
    messageId?: string,
  ) {
    if (userId === actorId) return null;

    const notification = await this.prisma.notification.create({
      data: {
        userId,
        actorId,
        type,
        postId,
        messageId,
      },
    });

    this.realtime.enviarAUsuario(
      userId,
      'notification:new',
      notification,
    );

    return notification;
  }

  @OnEvent(SOCIAL_EVENTS.LIKE_CREATED, { async: true })
  async onLike(event: LikeEvent) {
    try {
      await this.createNotification(
        event.postAuthorId,
        event.actorId,
        'LIKE',
        event.postId,
      );
    } catch (error) {
      this.logger.error('Error al notificar like', error);
    }
  }

  @OnEvent(SOCIAL_EVENTS.COMMENT_CREATED, { async: true })
  async onComment(event: CommentEvent) {
    try {
      await this.createNotification(
        event.postAuthorId,
        event.actorId,
        'COMMENT',
        event.postId,
      );
    } catch (error) {
      this.logger.error('Error al notificar comentario', error);
    }
  }

  @OnEvent(SOCIAL_EVENTS.FOLLOW_CREATED, { async: true })
  async onFollow(event: FollowEvent) {
    try {
      await this.createNotification(
        event.followingId,
        event.followerId,
        'FOLLOW',
      );
    } catch (error) {
      this.logger.error('Error al notificar seguidor', error);
    }
  }

  @OnEvent(SOCIAL_EVENTS.COUNTS_CHANGED)
  onCountsChanged(event: CountsEvent) {
    this.realtime.server.emit('post:counts', event);
  }

  async list(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async markAsRead(notificationId: string, userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId,
      },
      data: { isRead: true },
    });

    if (result.count === 0) {
      throw new NotFoundException('Notificación no encontrada');
    }

    return this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });
  }

  async notifyMessage(
    recipientId: string,
    senderId: string,
    messageId: string,
  ) {
    return this.createNotification(
      recipientId,
      senderId,
      'MESSAGE',
      undefined,
      messageId,
    );
  }
}
