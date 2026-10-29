import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsIn,
  IsString,
  Validate,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { MediaUrlValidator } from '../../media/media-url.validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ maxLength: 80, example: 'Estudiando' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  statusMessage?: string;

  @ApiPropertyOptional({ enum: ['classic', 'ocean', 'rose', 'forest'] })
  @IsOptional()
  @IsIn(['classic', 'ocean', 'rose', 'forest'])
  profileTheme?: string;

  @ApiPropertyOptional({
    example: 'Mi perfil HiVibe',
    description: 'Nombre visible en el perfil',
    minLength: 2,
    maxLength: 80,
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  @Matches(/\S/, {
    message: 'El nombre visible no puede contener solo espacios',
  })
  displayName?: string;

  @ApiPropertyOptional({
    example: 'Me gusta la música y conocer nuevos Panas.',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @ApiPropertyOptional({
    description: 'URL HTTPS de la imagen de perfil',
    example: 'https://example.com/avatar.jpg',
    format: 'uri',
    maxLength: 2048,
  })
  @IsOptional()
  @Validate(MediaUrlValidator)
  @MaxLength(2048)
  avatarUrl?: string;

  @ApiPropertyOptional({
    description: 'URL HTTPS de la imagen de portada',
    example: 'https://example.com/portada.jpg',
    format: 'uri',
    maxLength: 2048,
  })
  @IsOptional()
  @Validate(MediaUrlValidator)
  @MaxLength(2048)
  coverUrl?: string;
}
