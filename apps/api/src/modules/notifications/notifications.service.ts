import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../database/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { SOCIAL_EVENTS } from '../social/social.events';
import { AUTHOR_SELECT } from '../social/post.mapper';
import type { Pagination } from '../social/pagination';
import type {
  LikeEvent,
  CommentEvent,
  FollowEvent,
  CountsEvent,
  CommentLikeEvent,
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
    commentId?: string,
  ) {
    if (userId === actorId) return null;
    const notification = await this.prisma.notification.create({
      data: { userId, actorId, type, postId, commentId },
      include: { actor: { select: AUTHOR_SELECT } },
    });
    this.realtime.enviarAUsuario(userId, 'notification:new', notification);
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
      this.logger.error('Error al notificar reacción', error);
    }
  }
  @OnEvent(SOCIAL_EVENTS.COMMENT_CREATED, { async: true })
  async onComment(event: CommentEvent) {
    try {
      const recipients = new Set([
        event.postAuthorId,
        ...(event.parentAuthorId ? [event.parentAuthorId] : []),
      ]);
      for (const recipient of recipients)
        await this.createNotification(
          recipient,
          event.actorId,
          event.parentId ? 'COMMENT_REPLY' : 'COMMENT',
          event.postId,
          event.commentId,
        );
    } catch (error) {
      this.logger.error('Error al notificar comentario', error);
    }
  }
  @OnEvent(SOCIAL_EVENTS.COMMENT_LIKED, { async: true })
  async onCommentLike(event: CommentLikeEvent) {
    try {
      await this.createNotification(
        event.commentAuthorId,
        event.actorId,
        'COMMENT_LIKE',
        event.postId,
        event.commentId,
      );
    } catch (error) {
      this.logger.error('Error al notificar reacción a comentario', error);
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
    this.realtime.broadcast('post:counts', event);
  }
  @OnEvent(SOCIAL_EVENTS.COMMENT_CHANGED)
  onCommentChanged(event: {
    postId: string;
    commentId: string;
    parentId: string | null;
  }) {
    this.realtime.broadcast('comment:changed', event);
  }

  async unread(userId: string) {
    return {
      count: await this.prisma.notification.count({
        where: { userId, isRead: false, type: { not: 'MESSAGE' } },
      }),
    };
  }
  async list(userId: string, pagination: Pagination) {
    return this.prisma.notification.findMany({
      where: { userId, type: { not: 'MESSAGE' } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: pagination.skip,
      take: pagination.limit,
      include: { actor: { select: AUTHOR_SELECT } },
    });
  }
  async markAsRead(notificationId: string, userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { id: notificationId, userId, type: { not: 'MESSAGE' } },
      data: { isRead: true },
    });
    if (!result.count)
      throw new NotFoundException('Notificación no encontrada');
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
      include: { actor: { select: AUTHOR_SELECT } },
    });
    this.realtime.enviarAUsuario(userId, 'notification:read', {
      id: notificationId,
    });
    return notification;
  }
}
