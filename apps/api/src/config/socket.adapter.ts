import { IoAdapter } from '@nestjs/platform-socket.io';
import { ConfigService } from '@nestjs/config';
import type { INestApplicationContext } from '@nestjs/common';
import type { ServerOptions } from 'socket.io';

/** Lee ConfigService después de cargar .env, incluyendo el transporte WebSocket. */
export class AuthenticatedSocketAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly config: ConfigService,
  ) {
    super(app);
  }
  override createIOServer(port: number, options?: Partial<ServerOptions>) {
    const origin = this.config.getOrThrow<string>('FRONTEND_URL');
    return super.createIOServer(port, {
      ...options,
      cors: { origin, methods: ['GET', 'POST'] },
      maxHttpBufferSize: 64 * 1024,
      allowRequest: (request, done) => {
        done(
          null,
          !request.headers.origin || request.headers.origin === origin,
        );
      },
    } as ServerOptions);
  }
}
