import { ApiProperty } from '@nestjs/swagger';
import { AuthorDto, PaginationMetaDto } from '../../social/dto/common.dto';

export class CommentDto {
  @ApiProperty() id!: string;
  @ApiProperty() postId!: string;
  @ApiProperty({ example: '¡Buenísimo, pana!' }) body!: string;
  @ApiProperty({ type: AuthorDto }) author!: AuthorDto;
  @ApiProperty({ example: '2026-10-26T15:35:00.000Z' }) createdAt!: string;
}

export class CreatedCommentDto extends CommentDto {
  @ApiProperty({ example: 2, description: 'Total actualizado de comentarios del post' }) commentsCount!: number;
}

export class PaginatedCommentsDto {
  @ApiProperty({ type: [CommentDto] }) data!: CommentDto[];
  @ApiProperty({ type: PaginationMetaDto }) meta!: PaginationMetaDto;
}

export class DeletedCommentDto {
  @ApiProperty({ example: true }) deleted!: boolean;
  @ApiProperty() id!: string;
  @ApiProperty() postId!: string;
  @ApiProperty({ example: 1 }) commentsCount!: number;
}
