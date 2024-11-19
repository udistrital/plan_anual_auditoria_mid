import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { environment } from './config/configuration';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number(environment.PLAN_ANUAL_AUDITORIA_PORT);
  app.enableCors({
    origin: 'http://localhost:4200', 
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true, 
  });
  await app.listen(port);
}
bootstrap();
