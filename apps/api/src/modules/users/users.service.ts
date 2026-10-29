import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { UpdateProfileDto } from './dto/update-profile.dto';

const profileSelect = {
  id: true,
  username: true,
  email: true,
  displayName: true,
  bio: true,
  avatarUrl: true,
  coverUrl: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: profileSelect,
    });

    if (!user) {
      throw new UnauthorizedException('El usuario ya no existe');
    }

    return user;
  }

  async updateMe(userId: string, dto: UpdateProfileDto) {
    if (Object.values(dto).some((value) => value === null)) {
      throw new BadRequestException('Los campos no pueden ser null');
    }

    try {
      return await this.prisma.user.update({
        where: { id: userId },
        data: {
          displayName: dto.displayName?.trim(),
          bio: dto.bio,
          avatarUrl: dto.avatarUrl,
          coverUrl: dto.coverUrl,
        },
        select: profileSelect,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new UnauthorizedException('El usuario ya no existe');
      }

      throw error;
    }
  }

  async findPublicProfile(username: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        username: username.toLowerCase(),
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        bio: true,
        avatarUrl: true,
        coverUrl: true,
        createdAt: true,
        _count: { select: { posts: true, followers: true, following: true } },
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const { _count, ...profile } = user;
    return {
      ...profile,
      postsCount: _count.posts,
      followersCount: _count.followers,
      followingCount: _count.following,
    };
  }

  async relationship(username: string, userId: string) {
    const target = await this.prisma.user.findUnique({
      where: { username: username.toLowerCase() },
      select: { id: true },
    });
    if (!target) throw new NotFoundException('Usuario no encontrado');
    const follow = await this.prisma.follow.findUnique({
      where: {
        followerId_followingId: { followerId: userId, followingId: target.id },
      },
    });
    return { userId: target.id, isFollowedByMe: !!follow };
  }
}
