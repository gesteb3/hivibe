import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({ required: false, format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  parentId?: string;
  @ApiProperty({ example: '¡Buenísimo, pana!', maxLength: 500 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  body!: string;
}
