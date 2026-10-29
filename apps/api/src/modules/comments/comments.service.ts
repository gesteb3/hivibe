import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../social/social-deps';
import { buildMeta, Pagination } from '../social/pagination';
import { AUTHOR_SELECT } from '../social/post.mapper';
import { SOCIAL_EVENTS } from '../social/social.events';
import { CreateCommentDto } from './dto/create-comment.dto';

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService, @Optional() private readonly events?: EventEmitter2) {}

  private async emitCounts(postId: string, commentsCount: number) {
    const likesCount = await this.prisma.like.count({ where: { postId } });
    this.events?.emit(SOCIAL_EVENTS.COUNTS_CHANGED, { postId, likesCount, commentsCount });
  }

  /** Comentarios en orden cronológico (los más antiguos primero). */
  async list(postId: string, pag: Pagination) {
    const post = await this.prisma.post.findUnique({ where: { id: postId }, select: { id: true } });
    if (!post) throw new NotFoundException('Publicación no encontrada');
    const where = { postId };
    const [total, data] = await this.prisma.$transaction([
      this.prisma.comment.count({ where }),
      this.prisma.comment.findMany({
        where,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        skip: pag.skip,
        take: pag.limit,
        include: { author: { select: AUTHOR_SELECT } },
      }),
    ]);
    return { data, meta: buildMeta(total as number, pag) };
  }

  async create(postId: string, userId: string, dto: CreateCommentDto) {
    const post = await this.prisma.post.findUnique({ where: { id: postId }, select: { id: true, authorId: true } });
    if (!post) throw new NotFoundException('Publicación no encontrada');
    const body = dto.body?.trim();
    if (!body) throw new BadRequestException('El comentario no puede estar vacío');

    const comment = await this.prisma.comment.create({
      data: { postId, authorId: userId, body },
      include: { author: { select: AUTHOR_SELECT } },
    });
    const commentsCount = await this.prisma.comment.count({ where: { postId } });
    this.events?.emit(SOCIAL_EVENTS.COMMENT_CREATED, {
      postId, commentId: comment.id, postAuthorId: post.authorId, actorId: userId,
    });
    await this.emitCounts(postId, commentsCount);
    return { ...comment, commentsCount };
  }

  async remove(commentId: string, userId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true, postId: true, authorId: true },
    });
    if (!comment) throw new NotFoundException('Comentario no encontrado');
    if (comment.authorId !== userId) throw new ForbiddenException('Solo puedes borrar tus propios comentarios');

    await this.prisma.comment.delete({ where: { id: commentId } });
    const commentsCount = await this.prisma.comment.count({ where: { postId: comment.postId } });
    this.events?.emit(SOCIAL_EVENTS.COMMENT_REMOVED, { postId: comment.postId, commentId, actorId: userId });
    await this.emitCounts(comment.postId, commentsCount);
    return { deleted: true, id: commentId, postId: comment.postId, commentsCount };
  }
}
