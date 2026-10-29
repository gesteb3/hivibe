import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CommentsService } from './comments.service';

const makePrisma = () => ({
  post: { findUnique: jest.fn().mockResolvedValue({ id: 'p1', authorId: 'u1' }) },
  comment: { create: jest.fn(), findUnique: jest.fn(), delete: jest.fn(), count: jest.fn().mockResolvedValue(2), findMany: jest.fn() },
  like: { count: jest.fn().mockResolvedValue(5) },
  $transaction: jest.fn(),
});

describe('CommentsService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: CommentsService;
  beforeEach(() => {
    prisma = makePrisma();
    service = new CommentsService(prisma as any, { emit: jest.fn() } as any);
  });

  it('crea un comentario y devuelve el total actualizado', async () => {
    prisma.comment.create.mockResolvedValue({ id: 'c1', postId: 'p1', body: 'hey' });
    const res = await service.create('p1', 'u2', { body: ' hey ' });
    expect(prisma.comment.create.mock.calls[0][0].data).toEqual({ postId: 'p1', authorId: 'u2', body: 'hey' });
    expect(res).toMatchObject({ id: 'c1', commentsCount: 2 });
  });

  it('comentario vacío → 400', async () => {
    await expect(service.create('p1', 'u2', { body: '   ' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('comentar un post inexistente → 404', async () => {
    prisma.post.findUnique.mockResolvedValue(null);
    await expect(service.create('x', 'u2', { body: 'hey' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('no se puede borrar el comentario de otro (403)', async () => {
    prisma.comment.findUnique.mockResolvedValue({ id: 'c1', postId: 'p1', authorId: 'u1' });
    await expect(service.remove('c1', 'u2')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.comment.delete).not.toHaveBeenCalled();
  });

  it('el autor borra su comentario', async () => {
    prisma.comment.findUnique.mockResolvedValue({ id: 'c1', postId: 'p1', authorId: 'u2' });
    await expect(service.remove('c1', 'u2')).resolves.toMatchObject({ deleted: true, postId: 'p1', commentsCount: 2 });
  });

  it('lista paginada con meta', async () => {
    prisma.$transaction.mockResolvedValue([45, [{ id: 'c1' }]]);
    const res = await service.list('p1', { page: 2, limit: 20, skip: 20 });
    expect(res.meta).toEqual({ page: 2, limit: 20, total: 45, totalPages: 3 });
  });
});
