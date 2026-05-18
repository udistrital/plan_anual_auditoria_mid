import { Module } from '@nestjs/common';
import { ActividadService } from './actividad.service';
import { ActividadController } from './actividad.controller';
import { ServicesModule } from 'src/shared/services/services.module';

@Module({
  imports: [ServicesModule],
  controllers: [ActividadController],
  providers: [ActividadService],
})
export class ActividadModule {}
