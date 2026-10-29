import { ApiProperty } from '@nestjs/swagger';
import { AuthorDto, PaginationMetaDto } from '../../social/dto/common.dto';

export class PostResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'Hola panas' }) body!: string | null;
  @ApiProperty({ nullable: true, example: 'https://res.cloudinary.com/demo/image/upload/abc.jpg' }) imageUrl!: string | null;
  @ApiProperty({ type: AuthorDto }) author!: AuthorDto;
  @ApiProperty({ example: 3 }) likesCount!: number;
  @ApiProperty({ example: 1 }) commentsCount!: number;
  @ApiProperty({ example: false, description: 'Si el usuario autenticado ya dio like' }) likedByMe!: boolean;
  @ApiProperty({ example: '2026-10-26T15:30:00.000Z' }) createdAt!: string;
  @ApiProperty({ example: '2026-10-26T15:30:00.000Z' }) updatedAt!: string;
}

export class PaginatedPostsDto {
  @ApiProperty({ type: [PostResponseDto] }) data!: PostResponseDto[];
  @ApiProperty({ type: PaginationMetaDto }) meta!: PaginationMetaDto;
}
