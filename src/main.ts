import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { environment } from './config/configuration';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = `${environment.PLAN_ANUAL_AUDITORIA_PORT}`;

  app.enableCors({
    origin: 'http://localhost:4200',
    methods: 'GET,POST,PUT,DELETE',
    allowedHeaders: 'Content-Type, Authorization',
  });

  await app.listen(port);
}
bootstrap();
