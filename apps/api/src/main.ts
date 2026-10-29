import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './config/configure-app';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  app.enableShutdownHooks();
  const port = Number(app.get(ConfigService).get<string>('PORT')) || 4300;
  await app.listen(port, '0.0.0.0');
  console.log(`HiVibe API: http://localhost:${port}/api`);
  console.log(`Swagger: http://localhost:${port}/api/docs`);
}
bootstrap().catch(() => {
  console.error(
    'No se pudo iniciar HiVibe. Revisa configuración y PostgreSQL.',
  );
  process.exitCode = 1;
});
