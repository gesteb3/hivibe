import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../social/social-deps';
import { buildMeta, Pagination } from '../social/pagination';
import { AUTHOR_SELECT } from '../social/post.mapper';
import { SOCIAL_EVENTS } from '../social/social.events';
import { CreateCommentDto } from './dto/create-comment.dto';

const commentInclude = (userId: string) => ({
  author: { select: AUTHOR_SELECT },
  _count: { select: { likes: true, replies: true } },
  likes: { where: { userId }, select: { userId: true }, take: 1 },
});
const mapComment = (row: any): any => {
  const { likes, _count, replies, ...rest } = row;
  return {
    ...rest,
    rootId: row.parentId ?? row.id,
    likesCount: _count?.likes ?? 0,
    likedByMe: !!likes?.length,
    repliesCount: _count?.replies ?? 0,
    ...(replies ? { replies: replies.map(mapComment) } : {}),
  };
};

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly events?: EventEmitter2,
  ) {}

  private async changed(
    postId: string,
    commentId: string,
    parentId?: string | null,
  ) {
    const [likesCount, commentsCount] = await Promise.all([
      this.prisma.like.count({ where: { postId } }),
      this.prisma.comment.count({ where: { postId } }),
    ]);
    this.events?.emit(SOCIAL_EVENTS.COUNTS_CHANGED, {
      postId,
      likesCount,
      commentsCount,
    });
    this.events?.emit(SOCIAL_EVENTS.COMMENT_CHANGED, {
      postId,
      commentId,
      parentId: parentId ?? null,
    });
    return commentsCount;
  }

  async list(postId: string, pag: Pagination, userId = '') {
    if (
      !(await this.prisma.post.findUnique({
        where: { id: postId },
        select: { id: true },
      }))
    )
      throw new NotFoundException('Publicación no encontrada');
    const where = { postId, parentId: null };
    const [total, data] = await this.prisma.$transaction([
      this.prisma.comment.count({ where }),
      this.prisma.comment.findMany({
        where,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        skip: pag.skip,
        take: pag.limit,
        include: {
          ...commentInclude(userId),
          replies: {
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            take: 20,
            include: commentInclude(userId),
          },
        },
      }),
    ]);
    return { data: data.map(mapComment), meta: buildMeta(total, pag) };
  }

  async findOne(commentId: string, userId: string) {
    const row = await this.prisma.comment.findUnique({
      where: { id: commentId },
      include: commentInclude(userId),
    });
    if (!row) throw new NotFoundException('Comentario no encontrado');
    return mapComment(row);
  }

  async replies(commentId: string, userId: string, pag: Pagination) {
    const root = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true, parentId: true },
    });
    if (!root) throw new NotFoundException('Comentario no encontrado');
    const where = { parentId: root.parentId ?? root.id };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.comment.count({ where }),
      this.prisma.comment.findMany({
        where,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        skip: pag.skip,
        take: pag.limit,
        include: commentInclude(userId),
      }),
    ]);
    return { data: rows.map(mapComment), meta: buildMeta(total, pag) };
  }

  async create(postId: string, userId: string, dto: CreateCommentDto) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, authorId: true },
    });
    if (!post) throw new NotFoundException('Publicación no encontrada');
    const body = dto.body?.trim();
    if (!body)
      throw new BadRequestException('El comentario no puede estar vacío');
    const parent = dto.parentId
      ? await this.prisma.comment.findUnique({
          where: { id: dto.parentId },
          select: { id: true, postId: true, parentId: true, authorId: true },
        })
      : null;
    if (dto.parentId && (!parent || parent.postId !== postId))
      throw new BadRequestException(
        'El comentario padre no pertenece a esta publicación',
      );
    if (parent?.parentId)
      throw new BadRequestException(
        'Responde al comentario principal; los hilos tienen un nivel de respuestas',
      );
    const comment = await this.prisma.comment.create({
      data: { postId, authorId: userId, body, parentId: parent?.id ?? null },
      include: commentInclude(userId),
    });
    this.events?.emit(SOCIAL_EVENTS.COMMENT_CREATED, {
      postId,
      commentId: comment.id,
      postAuthorId: post.authorId,
      actorId: userId,
      parentId: parent?.id ?? null,
      parentAuthorId: parent?.authorId,
    });
    const commentsCount = await this.changed(postId, comment.id, parent?.id);
    return { ...mapComment(comment), commentsCount };
  }

  async remove(commentId: string, userId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true, postId: true, authorId: true, parentId: true },
    });
    if (!comment) throw new NotFoundException('Comentario no encontrado');
    if (comment.authorId !== userId)
      throw new ForbiddenException(
        'Solo puedes borrar tus propios comentarios',
      );
    await this.prisma.comment.delete({ where: { id: commentId } });
    const commentsCount = await this.changed(
      comment.postId,
      commentId,
      comment.parentId,
    );
    return {
      deleted: true,
      id: commentId,
      postId: comment.postId,
      commentsCount,
    };
  }

  async like(commentId: string, userId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true, postId: true, authorId: true, parentId: true },
    });
    if (!comment) throw new NotFoundException('Comentario no encontrado');
    try {
      await this.prisma.commentLike.create({ data: { commentId, userId } });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002')
        throw new ConflictException('Ya reaccionaste a este comentario');
      throw error;
    }
    const likesCount = await this.prisma.commentLike.count({
      where: { commentId },
    });
    this.events?.emit(SOCIAL_EVENTS.COMMENT_LIKED, {
      commentId,
      postId: comment.postId,
      commentAuthorId: comment.authorId,
      actorId: userId,
    });
    this.events?.emit(SOCIAL_EVENTS.COMMENT_CHANGED, {
      postId: comment.postId,
      commentId,
      parentId: comment.parentId,
    });
    return { commentId, liked: true, likesCount };
  }

  async unlike(commentId: string, userId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true, postId: true, parentId: true },
    });
    if (!comment) throw new NotFoundException('Comentario no encontrado');
    const result = await this.prisma.commentLike.deleteMany({
      where: { commentId, userId },
    });
    if (!result.count)
      throw new NotFoundException('No habías reaccionado a este comentario');
    const likesCount = await this.prisma.commentLike.count({
      where: { commentId },
    });
    this.events?.emit(SOCIAL_EVENTS.COMMENT_CHANGED, {
      postId: comment.postId,
      commentId,
      parentId: comment.parentId,
    });
    return { commentId, liked: false, likesCount };
  }
}
