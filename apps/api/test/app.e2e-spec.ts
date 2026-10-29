import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception/http-exception.filter';

describe('HiVibe API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.setGlobalPrefix('api');

    app.useGlobalFilters(new HttpExceptionFilter());

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('GET /api/health confirma que la API responde', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/health')
      .expect(200);

    expect(response.body.status).toBe('ok');
    expect(response.body.service).toBe('HiVibe API');
  });

  it('GET /api/users/me rechaza peticiones sin token', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/users/me')
      .expect(401);

    expect(response.body.statusCode).toBe(401);
    expect(response.body).toHaveProperty('timestamp');
  });

  it('GET /api/users/me rechaza un token inválido', async () => {
    await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', 'Bearer token-invalido')
      .expect(401);
  });

  it('PATCH /api/users/me exige autenticación', async () => {
    await request(app.getHttpServer())
      .patch('/api/users/me')
      .send({ displayName: 'Cambio sin permiso' })
      .expect(401);
  });

  it('POST /api/auth/register rechaza datos inválidos', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        username: '!',
        email: 'correo-invalido',
        password: '123',
        displayName: ' ',
        campoExtra: 'no permitido',
      })
      .expect(400);

    expect(Array.isArray(response.body.message)).toBe(true);
    expect(response.body.message).toContain(
      'property campoExtra should not exist',
    );
  });

  it('Una ruta inexistente devuelve el formato global de error', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/ruta-inexistente')
      .expect(404);

    expect(response.body.statusCode).toBe(404);
    expect(response.body.error).toBe('Not Found');
    expect(response.body).toHaveProperty('path');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).not.toHaveProperty('stack');
  });
});