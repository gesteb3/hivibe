import { FeedService } from './feed.service';
import { parsePagination } from '../social/pagination';

describe('FeedService / paginación', () => {
  const prisma: any = {
    post: { count: jest.fn(), findMany: jest.fn() },
    $transaction: jest.fn().mockResolvedValue([
      25,
      [{ id: 'p1', _count: { likes: 0, comments: 0 }, likes: [] }],
    ]),
  };
  const service = new FeedService(prisma);

  it('feed general no filtra y ordena por fecha desc', async () => {
    const res = await service.general('u1', parsePagination());
    expect(prisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {}, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: 0, take: 20 }),
    );
    expect(res.meta).toEqual({ page: 1, limit: 20, total: 25, totalPages: 2 });
    expect(res.data[0]).toMatchObject({ id: 'p1', likedByMe: false });
  });

  it('feed de Panas filtra por quienes sigo', async () => {
    await service.following('u1', parsePagination(2, 10));
    expect(prisma.post.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { author: { followers: { some: { followerId: 'u1' } } } }, skip: 10, take: 10 }),
    );
  });

  it('parsePagination corrige valores inválidos y limita a 50', () => {
    expect(parsePagination('abc', '-5')).toMatchObject({ page: 1, limit: 20 });
    expect(parsePagination(0, 999)).toMatchObject({ page: 1, limit: 50 });
    expect(parsePagination(3, 10)).toEqual({ page: 3, limit: 10, skip: 20 });
  });
});
