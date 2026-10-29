import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    example: 'nuevo_pana',
    description: 'Alias único: letras, números y guion bajo',
    minLength: 3,
    maxLength: 30,
  })
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'El alias solo puede contener letras, números y guion bajo',
  })
  username!: string;

  @ApiProperty({
    example: 'nuevo@example.com',
    format: 'email',
    maxLength: 254,
  })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({
    example: 'PruebaLocal2026!',
    format: 'password',
    writeOnly: true,
    minLength: 8,
    maxLength: 128,
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @ApiProperty({
    example: 'Nuevo Pana',
    description: 'Nombre visible en el perfil',
    minLength: 2,
    maxLength: 80,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  @Matches(/\S/, {
    message: 'El nombre visible no puede contener solo espacios',
  })
  displayName!: string;
}