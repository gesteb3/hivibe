import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { detectImageMime, MediaService } from './media.service';

const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(20)]);
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(20)]);
const fake = Buffer.from('<?php echo "no soy una imagen"; ?>');

describe('MediaService', () => {
  const service = new MediaService();
  const file = (buffer: Buffer, mimetype: string) => ({ buffer, mimetype } as any);

  it('detecta el tipo real por magic bytes', () => {
    expect(detectImageMime(jpeg)).toBe('image/jpeg');
    expect(detectImageMime(png)).toBe('image/png');
    expect(detectImageMime(fake)).toBeNull();
  });

  it('rechaza si no se envía archivo (400)', async () => {
    await expect(service.uploadImage(undefined, 'u1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza un archivo que dice ser imagen pero no lo es (400)', async () => {
    await expect(service.uploadImage(file(fake, 'image/png'), 'u1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza si el MIME declarado no coincide con el contenido (400)', async () => {
    await expect(service.uploadImage(file(png, 'image/jpeg'), 'u1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('sin credenciales de Cloudinary → 503', async () => {
    delete process.env.CLOUDINARY_CLOUD_NAME;
    await expect(service.uploadImage(file(jpeg, 'image/jpeg'), 'u1')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
