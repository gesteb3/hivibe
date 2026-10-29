import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { FollowsService } from './follows.service';

const makePrisma = () => ({
  user: { findUnique: jest.fn().mockResolvedValue({ id: 'u2' }) },
  follow: { create: jest.fn(), deleteMany: jest.fn(), count: jest.fn().mockResolvedValue(7), findMany: jest.fn() },
  $transaction: jest.fn(),
});

describe('FollowsService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: FollowsService;
  beforeEach(() => {
    prisma = makePrisma();
    service = new FollowsService(prisma as any, { emit: jest.fn() } as any);
  });

  it('impide el auto-seguimiento (400)', async () => {
    await expect(service.follow('u1', 'u1')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.follow.create).not.toHaveBeenCalled();
  });

  it('seguir a un usuario inexistente → 404', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.follow('zz', 'u1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('sigue y devuelve el total de seguidores', async () => {
    prisma.follow.create.mockResolvedValue({});
    await expect(service.follow('u2', 'u1')).resolves.toEqual({ userId: 'u2', following: true, followersCount: 7 });
    expect(prisma.follow.create).toHaveBeenCalledWith({ data: { followerId: 'u1', followingId: 'u2' } });
  });

  it('seguir dos veces → 409', async () => {
    prisma.follow.create.mockRejectedValue({ code: 'P2002' });
    await expect(service.follow('u2', 'u1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('deja de seguir', async () => {
    prisma.follow.deleteMany.mockResolvedValue({ count: 1 });
    await expect(service.unfollow('u2', 'u1')).resolves.toMatchObject({ following: false });
  });

  it('dejar de seguir a quien no sigues → 404', async () => {
    prisma.follow.deleteMany.mockResolvedValue({ count: 0 });
    await expect(service.unfollow('u2', 'u1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lista seguidores marcando isFollowedByMe', async () => {
    prisma.$transaction.mockResolvedValue([2, [{ follower: { id: 'a' } }, { follower: { id: 'b' } }]]);
    prisma.follow.findMany.mockResolvedValue([{ followingId: 'b' }]);
    const res = await service.followers('u2', 'me', { page: 1, limit: 20, skip: 0 });
    expect(res.data).toEqual([{ id: 'a', isFollowedByMe: false }, { id: 'b', isFollowedByMe: true }]);
    expect(res.meta.total).toBe(2);
  });
});
