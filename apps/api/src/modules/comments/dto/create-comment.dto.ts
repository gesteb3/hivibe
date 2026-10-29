import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({ example: '¡Buenísimo, pana!', maxLength: 500 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  body!: string;
}
