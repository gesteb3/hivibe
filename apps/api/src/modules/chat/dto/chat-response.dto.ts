import { ApiProperty } from '@nestjs/swagger';
import { AuthorDto } from '../../social/dto/common.dto';

export class MessageResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) conversationId!: string;
  @ApiProperty({ format: 'uuid' }) senderId!: string;
  @ApiProperty({ example: 'Hola, pana', maxLength: 2000 }) content!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}
export class ConversationResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) starterId!: string;
  @ApiProperty({ format: 'uuid' }) receiverId!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}
export class ConversationWithUsersDto extends ConversationResponseDto {
  @ApiProperty({ type: AuthorDto }) starter!: AuthorDto;
  @ApiProperty({ type: AuthorDto }) receiver!: AuthorDto;
}
