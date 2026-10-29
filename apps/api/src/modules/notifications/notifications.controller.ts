
import {
  Controller,
  Get,
  Patch,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

type AuthenticatedRequest = {
  user: {
    sub: string;
  };
};

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Consultar mis notificaciones',
  })
  async list(@Req() req: AuthenticatedRequest) {
    return this.notificationsService.list(req.user.sub);
  }

  @Patch(':id/read')
  @ApiOperation({
    summary: 'Marcar una notificación como leída',
  })
  async markAsRead(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.notificationsService.markAsRead(
      id,
      req.user.sub,
    );
  }
}
