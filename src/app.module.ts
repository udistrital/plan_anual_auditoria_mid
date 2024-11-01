import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PlanAuditoriaModule } from './plan-auditoria/plan-auditoria.module';
import { AuditoriaModule } from './auditoria/auditoria.module';
import { ActividadController } from './actividad/actividad.controller';
import { ActividadService } from './actividad/actividad.service';

@Module({
  imports: [PlanAuditoriaModule, AuditoriaModule],
  controllers: [AppController, ActividadController],
  providers: [AppService, ActividadService],
})
export class AppModule {}
