import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user: {
    sub: string;
  };
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>();

    const authorization = request.headers.authorization;
    const parts = authorization?.trim().split(/\s+/);

    if (
      !parts ||
      parts.length !== 2 ||
      parts[0].toLowerCase() !== 'bearer'
    ) {
      throw new UnauthorizedException('Debes iniciar sesión');
    }

    try {
      const payload = await this.jwt.verifyAsync<{ sub?: unknown }>(
        parts[1],
        {
          algorithms: ['HS256'],
        },
      );

      if (typeof payload.sub !== 'string' || !payload.sub) {
        throw new Error('Token sin identificador de usuario');
      }

      request.user = {
        sub: payload.sub,
      };

      return true;
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }
}