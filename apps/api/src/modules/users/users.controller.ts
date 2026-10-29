import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/guards/jwt-auth/jwt-auth.guard';
import {
  PublicProfileDto,
  OwnProfileDto,
  RelationshipDto,
} from './dto/profile-response.dto';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Consultar mi perfil' })
  @ApiOkResponse({
    description: 'Perfil del usuario autenticado',
    type: OwnProfileDto,
  })
  @ApiUnauthorizedResponse({ description: 'Token inválido o ausente' })
  getMe(@Req() request: AuthenticatedRequest) {
    return this.usersService.findMe(request.user.sub);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Editar mi perfil' })
  @ApiOkResponse({ description: 'Perfil actualizado', type: OwnProfileDto })
  @ApiBadRequestResponse({ description: 'Datos inválidos' })
  @ApiUnauthorizedResponse({ description: 'Token inválido o ausente' })
  updateMe(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateMe(request.user.sub, dto);
  }

  @Get(':username')
  @ApiOperation({ summary: 'Consultar un perfil público' })
  @ApiParam({
    name: 'username',
    example: 'usuario_prueba2',
    description: 'Alias del usuario',
  })
  @ApiOkResponse({
    description: 'Perfil público sin correo ni contraseña',
    type: PublicProfileDto,
  })
  @ApiNotFoundResponse({ description: 'Usuario no encontrado' })
  getPublicProfile(@Param('username') username: string) {
    return this.usersService.findPublicProfile(username);
  }

  @Get(':username/relationship')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: RelationshipDto })
  getRelationship(
    @Param('username') username: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.usersService.relationship(username, req.user.sub);
  }
}
