
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/guards/jwt-auth/jwt-auth.guard';

@ApiTags('Chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('conversations')
  @ApiOperation({ summary: 'Crear o recuperar una conversación privada' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['recipientId'],
      properties: {
        recipientId: {
          type: 'string',
          example: 'uuid-del-usuario-destinatario',
        },
      },
    },
  })
  crearConversacion(
    @Req() request: AuthenticatedRequest,
    @Body('recipientId') recipientId: string,
  ) {
    return this.chatService.crearConversacion(
      request.user.sub,
      recipientId,
    );
  }

  @Get('conversations')
  @ApiOperation({ summary: 'Listar mis conversaciones' })
  misConversaciones(@Req() request: AuthenticatedRequest) {
    return this.chatService.misConversaciones(request.user.sub);
  }

  @Get('conversations/:id/messages')
  @ApiOperation({ summary: 'Consultar historial de mensajes' })
  obtenerMensajes(
    @Req() request: AuthenticatedRequest,
    @Param('id') conversationId: string,
  ) {
    return this.chatService.obtenerMensajes(
      request.user.sub,
      conversationId,
    );
  }

  @Post('conversations/:id/messages')
  @ApiOperation({ summary: 'Enviar un mensaje privado' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['content'],
      properties: {
        content: {
          type: 'string',
          example: 'Hola, ¿cómo estás?',
          maxLength: 2000,
        },
      },
    },
  })
  enviarMensaje(
    @Req() request: AuthenticatedRequest,
    @Param('id') conversationId: string,
    @Body('content') content: string,
  ) {
    return this.chatService.enviarMensaje(
      request.user.sub,
      conversationId,
      content,
    );
  }
}
