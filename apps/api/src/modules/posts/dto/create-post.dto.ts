import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class CreatePostDto {
  @ApiPropertyOptional({ example: '¡Qué onda, panas! Mi primer post en HiVibe 🔥', maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  body?: string;

  @ApiPropertyOptional({
    description: 'URL HTTPS devuelta por POST /api/media/upload',
    example: 'https://res.cloudinary.com/demo/image/upload/hivibe/posts/abc123.jpg',
  })
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  imageUrl?: string;
}
