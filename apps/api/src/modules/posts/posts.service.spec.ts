import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PostsService } from './posts.service';

const makePrisma = () => ({
  post: { create: jest.fn(), findUnique: jest.fn(), delete: jest.fn() },
  user: { findUnique: jest.fn() },
});
const row = (o: object = {}) => ({
  id: 'p1', authorId: 'u1', body: 'hola', imageUrl: null,
  author: { id: 'u1', username: 'a', displayName: 'A', avatarUrl: null },
  _count: { likes: 2, comments: 1 }, likes: [{ userId: 'u1' }], ...o,
});

describe('PostsService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let events: { emit: jest.Mock };
  let service: PostsService;
  beforeEach(() => {
    prisma = makePrisma();
    events = { emit: jest.fn() };
    service = new PostsService(prisma as any, events as any);
  });

  it('crea un post de texto y devuelve contadores y likedByMe', async () => {
    prisma.post.create.mockResolvedValue(row());
    const res = await service.create('u1', { body: '  hola  ' });
    expect(prisma.post.create.mock.calls[0][0].data).toEqual({ authorId: 'u1', body: 'hola', imageUrl: null });
    expect(res).toMatchObject({ likesCount: 2, commentsCount: 1, likedByMe: true });
    expect(res).not.toHaveProperty('_count');
    expect(events.emit).toHaveBeenCalled();
  });

  it('crea un post solo con imagen', async () => {
    prisma.post.create.mockResolvedValue(row({ body: null, imageUrl: 'https://x/y.jpg' }));
    await expect(service.create('u1', { imageUrl: 'https://x/y.jpg' })).resolves.toBeDefined();
  });

  it('rechaza un post sin texto ni imagen (400)', async () => {
    await expect(service.create('u1', { body: '   ' })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.post.create).not.toHaveBeenCalled();
  });

  it('detalle inexistente → 404', async () => {
    prisma.post.findUnique.mockResolvedValue(null);
    await expect(service.findOne('x', 'u1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('B no puede borrar el post de A (403)', async () => {
    prisma.post.findUnique.mockResolvedValue({ id: 'p1', authorId: 'u1' });
    await expect(service.remove('p1', 'u2')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.post.delete).not.toHaveBeenCalled();
  });

  it('el autor sí puede borrar su post', async () => {
    prisma.post.findUnique.mockResolvedValue({ id: 'p1', authorId: 'u1' });
    await expect(service.remove('p1', 'u1')).resolves.toEqual({ deleted: true, id: 'p1' });
    expect(prisma.post.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
  });

  it('borrar un post inexistente → 404', async () => {
    prisma.post.findUnique.mockResolvedValue(null);
    await expect(service.remove('x', 'u1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
