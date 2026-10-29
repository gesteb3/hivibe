import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HttpExceptionFilter } from '../common/filters/http-exception/http-exception.filter';
import { AuthenticatedSocketAdapter } from './socket.adapter';
import express from 'express';
import { resolve } from 'node:path';

export function configureApp(app: INestApplication) {
  const config = app.get(ConfigService);
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableCors({
    origin: config.getOrThrow<string>('FRONTEND_URL'),
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useWebSocketAdapter(new AuthenticatedSocketAdapter(app, config));
  if (config.get<string>('MEDIA_PROVIDER') === 'local') {
    app.use(
      '/media',
      express.static(
        resolve(config.get<string>('MEDIA_LOCAL_PATH') ?? './uploads'),
        {
          dotfiles: 'deny',
          index: false,
          fallthrough: false,
          setHeaders: (response) => {
            response.setHeader('X-Content-Type-Options', 'nosniff');
          },
        },
      ),
    );
  }
  const swagger = new DocumentBuilder()
    .setTitle('HiVibe API')
    .setDescription(
      'REST: Bearer JWT. Socket.IO: auth.token; consultar README para eventos y reconexión.',
    )
    .setVersion('1.1')
    .addBearerAuth()
    .build();
  SwaggerModule.setup(
    'api/docs',
    app,
    SwaggerModule.createDocument(app, swagger),
  );
}
