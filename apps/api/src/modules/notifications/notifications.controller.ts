import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  ParseUUIDPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
  ApiTags,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';
import { ApiPagination, parsePagination } from '../social/pagination';
import { NotificationResponseDto } from './dto/notification-response.dto';

type AuthenticatedRequest = {
  user: {
    sub: string;
  };
};

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@ApiUnauthorizedResponse({ description: 'Token ausente o expirado' })
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('unread')
  @ApiOkResponse({
    schema: { type: 'object', properties: { count: { type: 'integer' } } },
  })
  unread(@Req() req: AuthenticatedRequest) {
    return this.notificationsService.unread(req.user.sub);
  }

  @Get()
  @ApiPagination()
  @ApiOkResponse({ type: [NotificationResponseDto] })
  @ApiOperation({
    summary: 'Consultar mis notificaciones',
  })
  async list(
    @Req() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notificationsService.list(
      req.user.sub,
      parsePagination(page, limit),
    );
  }

  @Patch(':id/read')
  @ApiOkResponse({ type: NotificationResponseDto })
  @ApiNotFoundResponse({ description: 'Notificación inexistente o ajena' })
  @ApiOperation({
    summary: 'Marcar una notificación como leída',
  })
  async markAsRead(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.notificationsService.markAsRead(id, req.user.sub);
  }
}
