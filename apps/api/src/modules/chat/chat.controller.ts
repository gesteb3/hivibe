import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ChatService } from './chat.service';
import {
  JwtAuthGuard,
  type AuthenticatedRequest,
} from '../auth/guards/jwt-auth/jwt-auth.guard';
import {
  CreateConversationDto,
  CreateMessageDto,
  MessageHistoryQueryDto,
} from './dto/chat.dto';
import {
  ConversationResponseDto,
  ConversationWithUsersDto,
  MessageResponseDto,
} from './dto/chat-response.dto';

@ApiTags('Chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@ApiBadRequestResponse({ description: 'Datos inválidos' })
@ApiUnauthorizedResponse({ description: 'Token ausente o expirado' })
@ApiForbiddenResponse({ description: 'No eres participante' })
@ApiNotFoundResponse({ description: 'Recurso no encontrado' })
@Controller('chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Post('conversations')
  @ApiOperation({ summary: 'Crear o recuperar conversación privada' })
  @ApiCreatedResponse({ type: ConversationResponseDto })
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateConversationDto) {
    return this.chat.crearConversacion(req.user.sub, dto.recipientId);
  }

  @Get('unread')
  @ApiOkResponse({
    schema: { type: 'object', properties: { count: { type: 'integer' } } },
  })
  unread(@Req() req: AuthenticatedRequest) {
    return this.chat.unread(req.user.sub);
  }

  @Patch('conversations/:id/read')
  @ApiOperation({ summary: 'Marcar mensajes de una conversación como leídos' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        conversationId: { type: 'string' },
        count: { type: 'integer' },
      },
    },
  })
  markRead(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.chat.markRead(req.user.sub, id);
  }

  @Get('conversations')
  @ApiOkResponse({ type: [ConversationWithUsersDto] })
  list(@Req() req: AuthenticatedRequest) {
    return this.chat.misConversaciones(req.user.sub);
  }

  @Get('conversations/:id/messages')
  @ApiOperation({
    summary:
      'Ventana reciente de mensajes; usar before para recuperar historial anterior',
  })
  @ApiOkResponse({
    type: [MessageResponseDto],
    description: 'Array en orden cronológico; vacío al terminar el historial.',
  })
  history(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query() query: MessageHistoryQueryDto,
  ) {
    return this.chat.obtenerMensajes(req.user.sub, id, query);
  }

  @Post('conversations/:id/messages')
  @ApiCreatedResponse({ type: MessageResponseDto })
  send(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CreateMessageDto,
  ) {
    return this.chat.enviarMensaje(req.user.sub, id, dto.content);
  }
}
