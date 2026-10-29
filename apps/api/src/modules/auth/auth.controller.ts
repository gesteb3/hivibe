import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@ApiTags('Auth')
@UseGuards(ThrottlerGuard)
@ApiResponse({
  status: 429,
  description: 'Demasiadas peticiones. Espera antes de volver a intentar.',
})
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Registrar una cuenta' })
  @ApiCreatedResponse({
    description: 'Usuario creado, sin contraseña ni hash',
  })
  @ApiBadRequestResponse({
    description: 'Datos inválidos o campos no permitidos',
  })
  @ApiConflictResponse({
    description: 'Alias o correo electrónico ya registrado',
  })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión y obtener un JWT' })
  @ApiOkResponse({
    description: 'Token Bearer válido por una hora y datos del usuario',
  })
  @ApiBadRequestResponse({
    description: 'Formato de credenciales inválido',
  })
  @ApiUnauthorizedResponse({
    description: 'Correo o contraseña incorrectos',
  })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}