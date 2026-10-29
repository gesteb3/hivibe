import { ApiProperty, ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Controller, Delete, Param, Post, UseGuards, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../social/social-deps';
import { CurrentUserId } from '../social/current-user.decorator';
import { LikesService } from './likes.service';

class LikeResponseDto {
  @ApiProperty() postId!: string;
  @ApiProperty({ example: true }) liked!: boolean;
  @ApiProperty({ example: 4 }) likesCount!: number;
}

@ApiTags('Likes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('posts/:id/like')
export class LikesController {
  constructor(private readonly likes: LikesService) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Dar like a una publicación' })
  @ApiResponse({ status: 201, type: LikeResponseDto })
  @ApiResponse({ status: 401, description: 'Sin sesión' })
  @ApiResponse({ status: 404, description: 'Publicación no encontrada' })
  @ApiResponse({ status: 409, description: 'Ya habías dado like' })
  like(@CurrentUserId() userId: string, @Param('id') postId: string) {
    return this.likes.like(postId, userId);
  }

  @Delete()
  @ApiOperation({ summary: 'Quitar like' })
  @ApiResponse({ status: 200, type: LikeResponseDto })
  @ApiResponse({ status: 401, description: 'Sin sesión' })
  @ApiResponse({ status: 404, description: 'Publicación no encontrada o sin like previo' })
  unlike(@CurrentUserId() userId: string, @Param('id') postId: string) {
    return this.likes.unlike(postId, userId);
  }
}
