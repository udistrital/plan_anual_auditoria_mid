import { Module } from '@nestjs/common';
import { PlanMejoramientoEstadoService } from './plan-mejoramiento-estado.service';
import { PlanMejoramientoEstadoController } from './plan-mejoramiento-estado.controller';
import { ServicesModule } from 'src/shared/services/services.module';

@Module({
  imports: [ServicesModule],
  controllers: [PlanMejoramientoEstadoController],
  providers: [PlanMejoramientoEstadoService],
})
export class PlanMejoramientoEstadoModule {}
