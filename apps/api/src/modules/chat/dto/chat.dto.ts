import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateConversationDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  recipientId!: string;
}

export class CreateMessageDto {
  @ApiProperty({ minLength: 1, maxLength: 2000, example: '¡Qué onda, pana!' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content!: string;
}

export class MessageHistoryQueryDto {
  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 50;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Id del mensaje más antiguo cargado; devuelve mensajes anteriores.',
  })
  @IsOptional()
  @IsUUID('4')
  before?: string;
}
