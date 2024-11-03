import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PlanAuditoriaModule } from './plan-auditoria/plan-auditoria.module';
import { AuditoriaModule } from './auditoria/auditoria.module';
import { ActividadModule } from './actividad/actividad.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [PlanAuditoriaModule,
    AuditoriaModule,
    ActividadModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
