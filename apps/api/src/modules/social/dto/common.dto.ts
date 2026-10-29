import { ApiProperty } from '@nestjs/swagger';

export class AuthorDto {
  @ApiProperty({ example: 'b1c2d3e4-0000-4000-8000-000000000001' }) id!: string;
  @ApiProperty({ example: 'chepe' }) username!: string;
  @ApiProperty({ example: 'Chepe Alucin', nullable: true }) displayName!: string | null;
  @ApiProperty({ example: 'https://res.cloudinary.com/demo/avatar.jpg', nullable: true }) avatarUrl!: string | null;
}

export class PaginationMetaDto {
  @ApiProperty({ example: 1 }) page!: number;
  @ApiProperty({ example: 20 }) limit!: number;
  @ApiProperty({ example: 57 }) total!: number;
  @ApiProperty({ example: 3 }) totalPages!: number;
}

export class DeletedDto {
  @ApiProperty({ example: true }) deleted!: boolean;
  @ApiProperty() id!: string;
}
