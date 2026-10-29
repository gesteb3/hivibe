import { ConflictException, NotFoundException } from '@nestjs/common';
import { LikesService } from './likes.service';
import { SOCIAL_EVENTS } from '../social/social.events';

const makePrisma = () => ({
  post: { findUnique: jest.fn().mockResolvedValue({ id: 'p1', authorId: 'u1' }) },
  like: { create: jest.fn(), deleteMany: jest.fn(), count: jest.fn().mockResolvedValue(3) },
  comment: { count: jest.fn().mockResolvedValue(1) },
});

describe('LikesService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let events: { emit: jest.Mock };
  let service: LikesService;
  beforeEach(() => {
    prisma = makePrisma();
    events = { emit: jest.fn() };
    service = new LikesService(prisma as any, events as any);
  });

  it('da like, devuelve el total y emite eventos', async () => {
    prisma.like.create.mockResolvedValue({});
    await expect(service.like('p1', 'u2')).resolves.toEqual({ postId: 'p1', liked: true, likesCount: 3 });
    expect(events.emit).toHaveBeenCalledWith(SOCIAL_EVENTS.LIKE_CREATED, { postId: 'p1', postAuthorId: 'u1', actorId: 'u2' });
    expect(events.emit).toHaveBeenCalledWith(SOCIAL_EVENTS.COUNTS_CHANGED, { postId: 'p1', likesCount: 3, commentsCount: 1 });
  });

  it('like duplicado → 409 y no emite', async () => {
    prisma.like.create.mockRejectedValue({ code: 'P2002' });
    await expect(service.like('p1', 'u2')).rejects.toBeInstanceOf(ConflictException);
    expect(events.emit).not.toHaveBeenCalled();
  });

  it('like a un post inexistente → 404', async () => {
    prisma.post.findUnique.mockResolvedValue(null);
    await expect(service.like('x', 'u2')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('unlike correcto', async () => {
    prisma.like.deleteMany.mockResolvedValue({ count: 1 });
    await expect(service.unlike('p1', 'u2')).resolves.toMatchObject({ liked: false, likesCount: 3 });
  });

  it('unlike sin like previo → 404', async () => {
    prisma.like.deleteMany.mockResolvedValue({ count: 0 });
    await expect(service.unlike('p1', 'u2')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('funciona sin EventEmitter (es opcional)', async () => {
    prisma.like.create.mockResolvedValue({});
    const s = new LikesService(prisma as any);
    await expect(s.like('p1', 'u2')).resolves.toMatchObject({ liked: true });
  });
});
