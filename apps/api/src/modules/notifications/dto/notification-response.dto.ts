import { ApiProperty } from '@nestjs/swagger';
import { AuthorDto } from '../../social/dto/common.dto';
export class NotificationResponseDto {
  @ApiProperty({ nullable: true }) commentId!: string | null;
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) userId!: string;
  @ApiProperty({ format: 'uuid' }) actorId!: string;
  @ApiProperty({
    enum: ['LIKE', 'COMMENT', 'COMMENT_REPLY', 'COMMENT_LIKE', 'FOLLOW'],
  })
  type!: string;
  @ApiProperty({ nullable: true }) postId!: string | null;
  @ApiProperty({ nullable: true }) messageId!: string | null;
  @ApiProperty() isRead!: boolean;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: AuthorDto }) actor!: AuthorDto;
}
