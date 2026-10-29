import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../social/social-deps';
import { CurrentUserId } from '../social/current-user.decorator';
import { ApiPagination, parsePagination } from '../social/pagination';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import {
  CreatedCommentDto,
  DeletedCommentDto,
  PaginatedCommentsDto,
  CommentDto,
  CommentLikeDto,
} from './dto/comment-response.dto';

@ApiTags('Comentarios')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}
  @Get('posts/:id/comments')
  @ApiPagination()
  @ApiResponse({ status: 200, type: PaginatedCommentsDto })
  @ApiOperation({
    summary:
      'Listar comentarios raíz con primeras 20 respuestas; paginar respuestas por separado',
  })
  list(
    @CurrentUserId() userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.comments.list(id, parsePagination(page, limit), userId);
  }
  @Get('comments/:id')
  @ApiResponse({ status: 200, type: CommentDto })
  detail(
    @CurrentUserId() userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.comments.findOne(id, userId);
  }
  @Get('comments/:id/replies')
  @ApiPagination()
  @ApiResponse({ status: 200, type: PaginatedCommentsDto })
  replies(
    @CurrentUserId() userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.comments.replies(id, userId, parsePagination(page, limit));
  }
  @Post('posts/:id/comments')
  @ApiResponse({ status: 201, type: CreatedCommentDto })
  create(
    @CurrentUserId() userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.comments.create(id, userId, dto);
  }
  @Delete('comments/:id')
  @ApiResponse({ status: 200, type: DeletedCommentDto })
  remove(
    @CurrentUserId() userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.comments.remove(id, userId);
  }
  @Post('comments/:id/like')
  @ApiResponse({ status: 201, type: CommentLikeDto })
  like(
    @CurrentUserId() userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.comments.like(id, userId);
  }
  @Delete('comments/:id/like')
  @ApiResponse({ status: 200, type: CommentLikeDto })
  unlike(
    @CurrentUserId() userId: string,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.comments.unlike(id, userId);
  }
}
