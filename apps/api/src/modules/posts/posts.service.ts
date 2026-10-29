import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../social/social-deps';
import { Pagination } from '../social/pagination';
import { findPostsPage, postInclude, toPostResponse } from '../social/post.mapper';
import { SOCIAL_EVENTS } from '../social/social.events';
import { CreatePostDto } from './dto/create-post.dto';

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService, @Optional() private readonly events?: EventEmitter2) {}

  async create(userId: string, dto: CreatePostDto) {
    const body = dto.body?.trim() || null;
    if (!body && !dto.imageUrl) {
      throw new BadRequestException('La publicación necesita texto o una imagen');
    }
    const post = await this.prisma.post.create({
      data: { authorId: userId, body, imageUrl: dto.imageUrl ?? null },
      include: postInclude(userId),
    });
    this.events?.emit(SOCIAL_EVENTS.POST_CREATED, { postId: post.id, authorId: userId });
    return toPostResponse(post);
  }

  async findOne(id: string, userId: string) {
    const post = await this.prisma.post.findUnique({ where: { id }, include: postInclude(userId) });
    if (!post) throw new NotFoundException('Publicación no encontrada');
    return toPostResponse(post);
  }

  async listByUser(targetUserId: string, userId: string, pag: Pagination) {
    const user = await this.prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return findPostsPage(this.prisma, { authorId: targetUserId }, userId, pag);
  }

  async remove(id: string, userId: string) {
    const post = await this.prisma.post.findUnique({ where: { id }, select: { id: true, authorId: true } });
    if (!post) throw new NotFoundException('Publicación no encontrada');
    if (post.authorId !== userId) throw new ForbiddenException('Solo puedes borrar tus propias publicaciones');
    await this.prisma.post.delete({ where: { id } }); // likes y comentarios caen por onDelete: Cascade
    return { deleted: true, id };
  }
}
