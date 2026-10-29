import { ApiProperty } from '@nestjs/swagger';
import { AuthorDto, PaginationMetaDto } from '../../social/dto/common.dto';

export class FollowActionDto {
  @ApiProperty() userId!: string;
  @ApiProperty({ example: true }) following!: boolean;
  @ApiProperty({ example: 12, description: 'Seguidores actuales del usuario objetivo' }) followersCount!: number;
}

export class PanaDto extends AuthorDto {
  @ApiProperty({ example: true, description: 'Si el usuario autenticado ya sigue a este usuario' }) isFollowedByMe!: boolean;
}

export class PaginatedPanasDto {
  @ApiProperty({ type: [PanaDto] }) data!: PanaDto[];
  @ApiProperty({ type: PaginationMetaDto }) meta!: PaginationMetaDto;
}
