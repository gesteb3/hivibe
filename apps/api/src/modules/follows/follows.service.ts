import { BadRequestException, ConflictException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../social/social-deps';
import { buildMeta, Pagination } from '../social/pagination';
import { AUTHOR_SELECT } from '../social/post.mapper';
import { SOCIAL_EVENTS } from '../social/social.events';

@Injectable()
export class FollowsService {
  constructor(private readonly prisma: PrismaService, @Optional() private readonly events?: EventEmitter2) {}

  private async assertUserExists(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
  }

  async follow(targetId: string, meId: string) {
    if (targetId === meId) throw new BadRequestException('No puedes seguirte a ti mismo');
    await this.assertUserExists(targetId);
    try {
      await this.prisma.follow.create({ data: { followerId: meId, followingId: targetId } });
    } catch (e) {
      if ((e as any)?.code === 'P2002') throw new ConflictException('Ya sigues a este usuario');
      throw e;
    }
    this.events?.emit(SOCIAL_EVENTS.FOLLOW_CREATED, { followerId: meId, followingId: targetId });
    const followersCount = await this.prisma.follow.count({ where: { followingId: targetId } });
    return { userId: targetId, following: true, followersCount };
  }

  async unfollow(targetId: string, meId: string) {
    if (targetId === meId) throw new BadRequestException('No puedes dejar de seguirte a ti mismo');
    await this.assertUserExists(targetId);
    const { count } = await this.prisma.follow.deleteMany({ where: { followerId: meId, followingId: targetId } });
    if (count === 0) throw new NotFoundException('No sigues a este usuario');
    this.events?.emit(SOCIAL_EVENTS.FOLLOW_REMOVED, { followerId: meId, followingId: targetId });
    const followersCount = await this.prisma.follow.count({ where: { followingId: targetId } });
    return { userId: targetId, following: false, followersCount };
  }

  /** Quienes siguen a `targetId`. */
  async followers(targetId: string, meId: string, pag: Pagination) {
    await this.assertUserExists(targetId);
    const where = { followingId: targetId };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.follow.count({ where }),
      this.prisma.follow.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pag.skip,
        take: pag.limit,
        include: { follower: { select: AUTHOR_SELECT } },
      }),
    ]);
    return this.withFollowedByMe((rows as any[]).map((r) => r.follower), meId, total as number, pag);
  }

  /** A quienes sigue `targetId` (sus Panas). */
  async following(targetId: string, meId: string, pag: Pagination) {
    await this.assertUserExists(targetId);
    const where = { followerId: targetId };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.follow.count({ where }),
      this.prisma.follow.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pag.skip,
        take: pag.limit,
        include: { following: { select: AUTHOR_SELECT } },
      }),
    ]);
    return this.withFollowedByMe((rows as any[]).map((r) => r.following), meId, total as number, pag);
  }

  private async withFollowedByMe(users: Array<{ id: string }>, meId: string, total: number, pag: Pagination) {
    const ids = users.map((u) => u.id);
    const mine: Array<{ followingId: string }> = ids.length
      ? await this.prisma.follow.findMany({
          where: { followerId: meId, followingId: { in: ids } },
          select: { followingId: true },
        })
      : [];
    const set = new Set(mine.map((f) => f.followingId));
    return { data: users.map((u) => ({ ...u, isFollowedByMe: set.has(u.id) })), meta: buildMeta(total, pag) };
  }
}
