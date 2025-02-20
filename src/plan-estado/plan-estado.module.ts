import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PlanEstadoService } from './plan-estado.service';
import { PlanEstadoController } from './plan-estado.controller';

@Module({
  imports: [HttpModule],
  controllers: [PlanEstadoController],
  providers: [PlanEstadoService],
})
export class PlanEstadoModule {}
