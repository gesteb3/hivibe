import { Controller, Delete, Get, Param, Post, Query, UseGuards, HttpCode } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../social/social-deps';
import { CurrentUserId } from '../social/current-user.decorator';
import { ApiPagination, parsePagination } from '../social/pagination';
import { FollowsService } from './follows.service';
import { FollowActionDto, PaginatedPanasDto } from './dto/follow-response.dto';

@ApiTags('Panas (seguidores)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users/:id')
export class FollowsController {
  constructor(private readonly follows: FollowsService) {}

  @Post('follow')
  @HttpCode(201)
  @ApiOperation({ summary: 'Seguir a un usuario (hacerlo tu Pana)' })
  @ApiResponse({ status: 201, type: FollowActionDto })
  @ApiResponse({ status: 400, description: 'Intentas seguirte a ti mismo' })
  @ApiResponse({ status: 401, description: 'Sin sesión' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  @ApiResponse({ status: 409, description: 'Ya lo sigues' })
  follow(@CurrentUserId() meId: string, @Param('id') targetId: string) {
    return this.follows.follow(targetId, meId);
  }

  @Delete('follow')
  @ApiOperation({ summary: 'Dejar de seguir a un usuario' })
  @ApiResponse({ status: 200, type: FollowActionDto })
  @ApiResponse({ status: 400, description: 'Intentas dejar de seguirte a ti mismo' })
  @ApiResponse({ status: 401, description: 'Sin sesión' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado o no lo seguías' })
  unfollow(@CurrentUserId() meId: string, @Param('id') targetId: string) {
    return this.follows.unfollow(targetId, meId);
  }

  @Get('followers')
  @ApiOperation({ summary: 'Seguidores de un usuario' })
  @ApiPagination()
  @ApiResponse({ status: 200, type: PaginatedPanasDto })
  @ApiResponse({ status: 401, description: 'Sin sesión' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  followers(@CurrentUserId() meId: string, @Param('id') targetId: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.follows.followers(targetId, meId, parsePagination(page, limit));
  }

  @Get('following')
  @ApiOperation({ summary: 'Usuarios que sigue un usuario (sus Panas)' })
  @ApiPagination()
  @ApiResponse({ status: 200, type: PaginatedPanasDto })
  @ApiResponse({ status: 401, description: 'Sin sesión' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  following(@CurrentUserId() meId: string, @Param('id') targetId: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.follows.following(targetId, meId, parsePagination(page, limit));
  }
}
