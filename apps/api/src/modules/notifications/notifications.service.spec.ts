import { NotificationsService } from './notifications.service';
describe('Notificaciones sociales separadas de mensajes', () => {
  const prisma = {
    notification: {
      create: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
      findFirst: jest.fn(),
    },
  };
  const realtime = { enviarAUsuario: jest.fn(), broadcast: jest.fn() };
  const service = new NotificationsService(prisma as any, realtime as any);
  beforeEach(() => jest.resetAllMocks());
  it('lista y contador excluyen mensajes históricos', async () => {
    prisma.notification.findMany.mockResolvedValue([]);
    prisma.notification.count.mockResolvedValue(2);
    expect(await service.unread('a')).toEqual({ count: 2 });
    await service.list('a', { page: 1, limit: 20, skip: 0 });
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'a', type: { not: 'MESSAGE' } },
      }),
    );
    expect(prisma.notification.count).toHaveBeenCalledWith({
      where: { userId: 'a', type: { not: 'MESSAGE' }, isRead: false },
    });
  });
  it('respuesta notifica al autor del hilo y del post sin duplicar destinatarios', async () => {
    prisma.notification.create.mockResolvedValue({ id: 'notice' });
    await service.onComment({
      postId: 'p',
      commentId: 'c',
      parentId: 'root',
      postAuthorId: 'a',
      parentAuthorId: 'a',
      actorId: 'b',
    });
    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          userId: 'a',
          actorId: 'b',
          type: 'COMMENT_REPLY',
          postId: 'p',
          commentId: 'c',
        },
      }),
    );
  });
  it('reacción propia no produce notificación', async () => {
    await service.onCommentLike({
      postId: 'p',
      commentId: 'c',
      commentAuthorId: 'a',
      actorId: 'a',
    });
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });
});
