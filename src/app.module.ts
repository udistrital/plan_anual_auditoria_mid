import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PlanAuditoriaModule } from './application/plan-auditoria/plan-auditoria.module';
import { AuditoriaModule } from './application/auditoria/auditoria.module';
import { AuditoriaPadreModule } from './application/auditoria-padre/auditoria-padre.module';
import { ActividadModule } from './application/actividad/actividad.module';
import { ConfigModule } from '@nestjs/config';
import { PlantillaModule } from './application/plantilla/plantilla.module';
import { CargueMasivoModule } from './application/cargue-masivo/cargue-masivo.module';
import { PlanEstadoModule } from './application/plan-estado/plan-estado.module';
import { AuditorModule } from './application/auditor/auditor.module';
import { InformeModule } from './application/informe/informe.module';
import { AuditoriaEstadoModule } from './application/auditoria-estado/auditoria-estado.module';
import { AuditadoModule } from './application/auditado/auditado.module';
import { LoggerModule } from 'nestjs-pino';
import { env } from './config/configuration';
import { ServicesModule } from './shared/services/services.module';

@Module({
  imports: [
    ActividadModule,
    AuditoriaEstadoModule,
    AuditoriaModule,
    AuditoriaPadreModule,
    AuditorModule,
    CargueMasivoModule,
    PlanAuditoriaModule,
    PlanEstadoModule,
    PlantillaModule,
    ConfigModule.forRoot({
      isGlobal: true,
      load: [env]
    }),
    InformeModule,
    AuditadoModule,
    LoggerModule.forRoot(),
    ServicesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
