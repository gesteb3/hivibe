import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ChatService } from './chat.service';
describe('Chat: seguridad e historial', () => {
  const prisma = {
    $executeRaw: jest.fn(),
    $queryRaw: jest.fn(),
    conversation: { findUnique: jest.fn() },
    message: { findMany: jest.fn(), findFirst: jest.fn() },
  };
  const service = new ChatService(prisma as any, {} as any);
  beforeEach(() => {
    jest.resetAllMocks();
    prisma.conversation.findUnique.mockResolvedValue({
      starterId: 'a',
      receiverId: 'b',
    });
  });
  it('un tercero no puede consultar mensajes', async () => {
    await expect(service.obtenerMensajes('c', 'conv')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.message.findMany).not.toHaveBeenCalled();
  });
  it('un tercero no puede marcar conversación como leída', async () => {
    await expect(service.markRead('c', 'conv')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });
  it('contador de mensajes convierte bigint a número JSON', async () => {
    prisma.$queryRaw.mockResolvedValue([{ count: 3n }]);
    expect(await service.unread('b')).toEqual({ count: 3 });
  });
  it('un número produce error de validación y no TypeError', async () => {
    await expect(
      service.enviarMensaje('a', 'conv', 123 as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it('carga la ventana más reciente en orden cronológico', async () => {
    prisma.message.findMany.mockResolvedValue([{ id: 'new' }, { id: 'old' }]);
    expect(await service.obtenerMensajes('a', 'conv')).toEqual([
      { id: 'old' },
      { id: 'new' },
    ]);
    expect(prisma.message.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 50,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    );
  });
  it('el cursor queda restringido a la conversación autorizada', async () => {
    prisma.message.findFirst.mockResolvedValue({
      id: 'old',
      createdAt: new Date(),
    });
    prisma.message.findMany.mockResolvedValue([]);
    await service.obtenerMensajes('a', 'conv', { limit: 10, before: 'old' });
    expect(prisma.message.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'old', conversationId: 'conv' } }),
    );
  });
});
