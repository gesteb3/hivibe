import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
export class PublicProfileDto {
  @ApiProperty({ nullable: true, maxLength: 80 }) statusMessage!: string | null;
  @ApiProperty({ enum: ['classic', 'ocean', 'rose', 'forest'] })
  profileTheme!: string;
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'mi_pana' }) username!: string;
  @ApiProperty({ example: 'Mi Pana' }) displayName!: string;
  @ApiProperty({ nullable: true }) bio!: string | null;
  @ApiProperty({ nullable: true }) avatarUrl!: string | null;
  @ApiProperty({ nullable: true }) coverUrl!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiPropertyOptional() postsCount?: number;
  @ApiPropertyOptional() followersCount?: number;
  @ApiPropertyOptional() followingCount?: number;
}
export class OwnProfileDto extends PublicProfileDto {
  @ApiProperty({ format: 'email' }) email!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}
export class RelationshipDto {
  @ApiProperty({ format: 'uuid' }) userId!: string;
  @ApiProperty() isFollowedByMe!: boolean;
}
