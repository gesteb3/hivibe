import { BadRequestException, Controller, HttpCode, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiProperty, ApiResponse, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import { JwtAuthGuard } from '../social/social-deps';
import { CurrentUserId } from '../social/current-user.decorator';
import { ALLOWED_EXT, ALLOWED_MIME, MAX_IMAGE_BYTES, MediaService } from './media.service';

class UploadResponseDto {
  @ApiProperty({ example: 'https://res.cloudinary.com/demo/image/upload/v1/hivibe/posts/abc.jpg' }) url!: string;
  @ApiProperty({ example: 'hivibe/posts/abc' }) publicId!: string;
  @ApiProperty({ example: 1080 }) width!: number;
  @ApiProperty({ example: 720 }) height!: number;
  @ApiProperty({ example: 'jpg' }) format!: string;
  @ApiProperty({ example: 184320 }) bytes!: number;
}

const imageFileFilter = (_req: unknown, file: Express.Multer.File, cb: (e: Error | null, accept: boolean) => void) => {
  const ext = extname(file.originalname || '').toLowerCase();
  if (!ALLOWED_MIME.includes(file.mimetype) || !ALLOWED_EXT.includes(ext)) {
    return cb(new BadRequestException('Formato no permitido. Usa JPG, PNG, WEBP o GIF'), false);
  }
  cb(null, true);
};

@ApiTags('Media')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post('upload')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Subir una imagen (máx. 5 MB; JPG, PNG, WEBP o GIF)',
    description: 'Devuelve la `url` que luego se envía como `imageUrl` en POST /api/posts.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiResponse({ status: 201, type: UploadResponseDto })
  @ApiResponse({ status: 400, description: 'Archivo ausente, formato no permitido o no es una imagen real' })
  @ApiResponse({ status: 401, description: 'Sin sesión' })
  @ApiResponse({ status: 413, description: 'La imagen supera 5 MB' })
  @ApiResponse({ status: 503, description: 'Almacenamiento no configurado o caído' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
      fileFilter: imageFileFilter,
    }),
  )
  upload(@UploadedFile() file: Express.Multer.File, @CurrentUserId() userId: string) {
    return this.media.uploadImage(file, userId);
  }
}
