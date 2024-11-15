import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PlanAuditoriaModule } from './plan-auditoria/plan-auditoria.module';
import { AuditoriaModule } from './auditoria/auditoria.module';
import { ActividadModule } from './actividad/actividad.module';
import { ConfigModule } from '@nestjs/config';
import { PlantillaModule } from './plantilla/plantilla.module';

@Module({
  imports: [PlanAuditoriaModule,
    AuditoriaModule,
    ActividadModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PlantillaModule,],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
