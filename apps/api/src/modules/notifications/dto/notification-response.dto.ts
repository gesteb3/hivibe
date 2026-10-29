import { ApiProperty } from '@nestjs/swagger';
import { AuthorDto } from '../../social/dto/common.dto';
export class NotificationResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) userId!: string;
  @ApiProperty({ format: 'uuid' }) actorId!: string;
  @ApiProperty({ enum: ['LIKE', 'COMMENT', 'FOLLOW', 'MESSAGE'] })
  type!: string;
  @ApiProperty({ nullable: true }) postId!: string | null;
  @ApiProperty({ nullable: true }) messageId!: string | null;
  @ApiProperty() isRead!: boolean;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: AuthorDto }) actor!: AuthorDto;
}
