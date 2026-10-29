import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../social/social-deps';
import { CurrentUserId } from '../social/current-user.decorator';
import { ApiPagination, parsePagination } from '../social/pagination';
import { DeletedDto } from '../social/dto/common.dto';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { PaginatedPostsDto, PostResponseDto } from './dto/post-response.dto';

@ApiTags('Posts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  @Post('posts')
  @ApiOperation({ summary: 'Crear publicación (texto, imagen o ambos)' })
  @ApiResponse({ status: 201, type: PostResponseDto })
  @ApiResponse({ status: 400, description: 'Sin texto ni imagen, o datos inválidos' })
  @ApiResponse({ status: 401, description: 'Sin sesión' })
  create(@CurrentUserId() userId: string, @Body() dto: CreatePostDto) {
    return this.posts.create(userId, dto);
  }

  @Get('posts/:id')
  @ApiOperation({ summary: 'Detalle de una publicación' })
  @ApiResponse({ status: 200, type: PostResponseDto })
  @ApiResponse({ status: 401, description: 'Sin sesión' })
  @ApiResponse({ status: 404, description: 'No existe' })
  findOne(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.posts.findOne(id, userId);
  }

  @Delete('posts/:id')
  @ApiOperation({ summary: 'Borrar publicación propia' })
  @ApiResponse({ status: 200, type: DeletedDto })
  @ApiResponse({ status: 401, description: 'Sin sesión' })
  @ApiResponse({ status: 403, description: 'La publicación es de otro usuario' })
  @ApiResponse({ status: 404, description: 'No existe' })
  remove(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.posts.remove(id, userId);
  }

  /** Extra para el muro del perfil (Gustavo). No estaba en el contrato original. */
  @Get('users/:id/posts')
  @ApiOperation({ summary: 'Publicaciones de un usuario (muro del perfil)' })
  @ApiPagination()
  @ApiResponse({ status: 200, type: PaginatedPostsDto })
  @ApiResponse({ status: 401, description: 'Sin sesión' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  listByUser(
    @CurrentUserId() userId: string,
    @Param('id') targetId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.posts.listByUser(targetId, userId, parsePagination(page, limit));
  }
}
