import { Module } from '@nestjs/common';
import { PlanEstadoService } from './plan-estado.service';
import { PlanEstadoController } from './plan-estado.controller';
import { ServicesModule } from 'src/shared/services/services.module';

@Module({
  imports: [ServicesModule],
  controllers: [PlanEstadoController],
  providers: [PlanEstadoService],
})
export class PlanEstadoModule {}
