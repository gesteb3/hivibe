import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../social/social-deps';
import { CurrentUserId } from '../social/current-user.decorator';
import { ApiPagination, parsePagination } from '../social/pagination';
import { PaginatedPostsDto } from '../posts/dto/post-response.dto';
import { FeedService } from './feed.service';

@ApiTags('Feed')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('feed')
export class FeedController {
  constructor(private readonly feed: FeedService) {}

  @Get()
  @ApiOperation({ summary: 'Feed general (más recientes primero)' })
  @ApiPagination()
  @ApiResponse({ status: 200, type: PaginatedPostsDto })
  @ApiResponse({ status: 401, description: 'Sin sesión' })
  general(@CurrentUserId() userId: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.feed.general(userId, parsePagination(page, limit));
  }

  @Get('following')
  @ApiOperation({ summary: 'Feed de Panas (publicaciones de quienes sigo)' })
  @ApiPagination()
  @ApiResponse({ status: 200, type: PaginatedPostsDto })
  @ApiResponse({ status: 401, description: 'Sin sesión' })
  following(@CurrentUserId() userId: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.feed.following(userId, parsePagination(page, limit));
  }
}
