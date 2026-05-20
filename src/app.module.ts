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
import { PlanMejoramientoAuditorModule } from './plan-mejoramiento-auditor/plan-mejoramiento-auditor.module';
import { ResponsableAccionModule } from './responsable-accion/responsable-accion.module';
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
    ConfigModule.forRoot({
      isGlobal: true,
      load: [env],
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport: process.env.NODE_ENV === 'production' ? undefined : {
          target: 'pino-pretty',
          options: { colorize: true }
        },
      }
    }),
    ActividadModule,
    AuditoriaEstadoModule,
    AuditoriaModule,
    AuditoriaPadreModule,
    AuditorModule,
    CargueMasivoModule,
    PlanAuditoriaModule,
    PlanEstadoModule,
    PlantillaModule,
    InformeModule,
    AuditadoModule,
    PlanMejoramientoAuditorModule,
    ResponsableAccionModule,
    ServicesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
  ],
})
export class AppModule {}
