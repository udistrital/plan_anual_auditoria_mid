import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { join } from 'path';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { env } from './config/configuration';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  const port = env().PLAN_AUDITORIA_MID_PORT;

  //Swagger
  const config = new DocumentBuilder()
    .setTitle('Plan Anual Auditoria MID')
    .setDescription(
      'API MID para la gestion de planes de auditorias, auditorias y actividades',
    )
    .setVersion('1.1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('swagger', app, document);

  //Swagger Saving
  const outputPath = join(process.cwd(), 'swagger');
  fs.mkdirSync(outputPath, { recursive: true });
  fs.writeFileSync(
    join(outputPath, 'swagger.json'),
    JSON.stringify(document, null, 2),
  );
  fs.writeFileSync(join(outputPath, 'swagger.yaml'), yaml.dump(document));

  //Enable CORS
  app.enableCors();
  await app.listen(parseInt(port, 10) || 8080);
}
bootstrap();
