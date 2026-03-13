import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PlanAuditoriaModule } from './plan-auditoria/plan-auditoria.module';
import { AuditoriaModule } from './application/auditoria/auditoria.module';
import { AuditoriaPadreModule } from './application/auditoria-padre/auditoria-padre.module';
import { ActividadModule } from './actividad/actividad.module';
import { ConfigModule } from '@nestjs/config';
import { PlantillaModule } from './application/plantilla/plantilla.module';
import { CargueMasivoModule } from './application/cargue-masivo/cargue-masivo.module';
import { PlanEstadoModule } from './plan-estado/plan-estado.module';
import { AuditorModule } from './auditor/auditor.module';
import { InformeModule } from './informe/informe.module';
import { AuditoriaEstadoModule } from './auditoria-estado/auditoria-estado.module';

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
      envFilePath: '.env',
    }),
    InformeModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
