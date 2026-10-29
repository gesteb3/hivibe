import { ConflictException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../social/social-deps';
import { SOCIAL_EVENTS } from '../social/social.events';

@Injectable()
export class LikesService {
  constructor(private readonly prisma: PrismaService, @Optional() private readonly events?: EventEmitter2) {}

  private async getPost(postId: string) {
    const post = await this.prisma.post.findUnique({ where: { id: postId }, select: { id: true, authorId: true } });
    if (!post) throw new NotFoundException('Publicación no encontrada');
    return post;
  }

  private async emitCounts(postId: string, likesCount: number) {
    const commentsCount = await this.prisma.comment.count({ where: { postId } });
    this.events?.emit(SOCIAL_EVENTS.COUNTS_CHANGED, { postId, likesCount, commentsCount });
  }

  async like(postId: string, userId: string) {
    const post = await this.getPost(postId);
    try {
      await this.prisma.like.create({ data: { userId, postId } });
    } catch (e) {
      if ((e as any)?.code === 'P2002') throw new ConflictException('Ya diste like a esta publicación');
      throw e;
    }
    const likesCount = await this.prisma.like.count({ where: { postId } });
    this.events?.emit(SOCIAL_EVENTS.LIKE_CREATED, { postId, postAuthorId: post.authorId, actorId: userId });
    await this.emitCounts(postId, likesCount);
    return { postId, liked: true, likesCount };
  }

  async unlike(postId: string, userId: string) {
    await this.getPost(postId);
    const { count } = await this.prisma.like.deleteMany({ where: { postId, userId } });
    if (count === 0) throw new NotFoundException('No habías dado like a esta publicación');
    const likesCount = await this.prisma.like.count({ where: { postId } });
    this.events?.emit(SOCIAL_EVENTS.LIKE_REMOVED, { postId, actorId: userId });
    await this.emitCounts(postId, likesCount);
    return { postId, liked: false, likesCount };
  }
}
