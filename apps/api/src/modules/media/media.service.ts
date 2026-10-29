import {
  BadRequestException,
  Injectable,
  Logger,
  NotImplementedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];
export const ALLOWED_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

/** Detecta el tipo real mirando los primeros bytes (no confiamos en el MIME que manda el cliente). */
export function detectImageMime(buf: Buffer): string | null {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)
    return 'image/jpeg';
  if (
    buf
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return 'image/png';
  const head6 = buf.subarray(0, 6).toString('ascii');
  if (head6 === 'GIF87a' || head6 === 'GIF89a') return 'image/gif';
  if (
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  )
    return 'image/webp';
  return null;
}

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  private configure() {
    const provider = process.env.MEDIA_PROVIDER ?? 'cloudinary';
    if (provider !== 'cloudinary')
      throw new NotImplementedException(
        `Proveedor de medios no soportado: ${provider}`,
      );
    const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } =
      process.env;
    if (
      !CLOUDINARY_CLOUD_NAME ||
      !CLOUDINARY_API_KEY ||
      !CLOUDINARY_API_SECRET
    ) {
      this.logger.error('Faltan variables CLOUDINARY_* en el entorno');
      throw new ServiceUnavailableException(
        'El almacenamiento de imágenes no está configurado',
      );
    }
    cloudinary.config({
      cloud_name: CLOUDINARY_CLOUD_NAME,
      api_key: CLOUDINARY_API_KEY,
      api_secret: CLOUDINARY_API_SECRET,
      secure: true,
    });
  }

  async uploadImage(file: Express.Multer.File | undefined, userId: string) {
    if (!file)
      throw new BadRequestException(
        'Envía una imagen en el campo "file" (multipart/form-data)',
      );
    const real = detectImageMime(file.buffer);
    if (!real || real !== file.mimetype) {
      throw new BadRequestException(
        'El archivo no es una imagen válida (JPG, PNG, WEBP o GIF)',
      );
    }
    if (file.buffer.length > MAX_IMAGE_BYTES)
      throw new BadRequestException('La imagen supera 5 MB');
    if (process.env.MEDIA_PROVIDER === 'local') {
      const base = process.env.MEDIA_PUBLIC_URL;
      if (!base)
        throw new ServiceUnavailableException('Falta MEDIA_PUBLIC_URL');
      const extension = (
        {
          'image/jpeg': 'jpg',
          'image/png': 'png',
          'image/webp': 'webp',
          'image/gif': 'gif',
        } as Record<string, string>
      )[real];
      const filename = `${randomUUID()}.${extension}`;
      const directory = resolve(process.env.MEDIA_LOCAL_PATH ?? './uploads');
      try {
        await mkdir(directory, { recursive: true });
        await writeFile(resolve(directory, filename), file.buffer, {
          flag: 'wx',
          mode: 0o644,
        });
      } catch {
        throw new ServiceUnavailableException('No se pudo guardar la imagen');
      }
      return {
        url: `${base.replace(/\/$/, '')}/${filename}`,
        publicId: filename,
        format: extension,
        bytes: file.buffer.length,
      };
    }
    this.configure();

    try {
      const res = await new Promise<UploadApiResponse>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'hivibe/posts',
            resource_type: 'image',
            tags: [`user_${userId}`],
          },
          (err, result) =>
            err || !result
              ? reject(err ?? new Error('Respuesta vacía de Cloudinary'))
              : resolve(result),
        );
        stream.end(file.buffer);
      });
      return {
        url: res.secure_url,
        publicId: res.public_id,
        width: res.width,
        height: res.height,
        format: res.format,
        bytes: res.bytes,
      };
    } catch (e) {
      this.logger.error(
        `Fallo al subir imagen: ${(e as Error)?.message ?? 'desconocido'}`,
      );
      throw new ServiceUnavailableException(
        'No se pudo subir la imagen, intenta de nuevo',
      );
    }
  }
}
