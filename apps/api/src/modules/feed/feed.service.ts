import { Injectable } from '@nestjs/common';
import { PrismaService } from '../social/social-deps';
import { Pagination } from '../social/pagination';
import { findPostsPage } from '../social/post.mapper';

@Injectable()
export class FeedService {
  constructor(private readonly prisma: PrismaService) {}

  /** Todas las publicaciones, más recientes primero. */
  general(userId: string, pag: Pagination) {
    return findPostsPage(this.prisma, {}, userId, pag);
  }

  /** Solo publicaciones de los Panas (usuarios que sigo). */
  following(userId: string, pag: Pagination) {
    return findPostsPage(this.prisma, { author: { followers: { some: { followerId: userId } } } }, userId, pag);
  }
}
