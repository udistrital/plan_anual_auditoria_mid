import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PlanAuditoriaModule } from './plan-auditoria/plan-auditoria.module';
import { AuditoriaModule } from './auditoria/auditoria.module';
import { ActividadModule } from './actividad/actividad.module';
import { ConfigModule } from '@nestjs/config';
import { PlantillaModule } from './plantilla/plantilla.module';
import { CargueMasivoModule } from './cargue-masivo/cargue-masivo.module';
import { PlanEstadoModule } from './plan-estado/plan-estado.module';
import { AuditorModule } from './auditor/auditor.module';

@Module({
  imports: [
    ActividadModule,
    AuditoriaModule,
    AuditorModule,
    CargueMasivoModule,
    PlanAuditoriaModule,
    PlanEstadoModule,
    PlantillaModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
