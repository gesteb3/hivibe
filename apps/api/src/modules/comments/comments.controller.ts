import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../social/social-deps';
import { CurrentUserId } from '../social/current-user.decorator';
import { ApiPagination, parsePagination } from '../social/pagination';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreatedCommentDto, DeletedCommentDto, PaginatedCommentsDto } from './dto/comment-response.dto';

@ApiTags('Comentarios')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get('posts/:id/comments')
  @ApiOperation({ summary: 'Listar comentarios de una publicación (más antiguos primero)' })
  @ApiPagination()
  @ApiResponse({ status: 200, type: PaginatedCommentsDto })
  @ApiResponse({ status: 401, description: 'Sin sesión' })
  @ApiResponse({ status: 404, description: 'Publicación no encontrada' })
  list(@Param('id') postId: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.comments.list(postId, parsePagination(page, limit));
  }

  @Post('posts/:id/comments')
  @ApiOperation({ summary: 'Comentar una publicación' })
  @ApiResponse({ status: 201, type: CreatedCommentDto })
  @ApiResponse({ status: 400, description: 'Comentario vacío o demasiado largo' })
  @ApiResponse({ status: 401, description: 'Sin sesión' })
  @ApiResponse({ status: 404, description: 'Publicación no encontrada' })
  create(@CurrentUserId() userId: string, @Param('id') postId: string, @Body() dto: CreateCommentDto) {
    return this.comments.create(postId, userId, dto);
  }

  @Delete('comments/:id')
  @ApiOperation({ summary: 'Borrar un comentario propio' })
  @ApiResponse({ status: 200, type: DeletedCommentDto })
  @ApiResponse({ status: 401, description: 'Sin sesión' })
  @ApiResponse({ status: 403, description: 'El comentario es de otro usuario' })
  @ApiResponse({ status: 404, description: 'Comentario no encontrado' })
  remove(@CurrentUserId() userId: string, @Param('id') commentId: string) {
    return this.comments.remove(commentId, userId);
  }
}
