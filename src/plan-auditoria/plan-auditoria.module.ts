import { Module } from '@nestjs/common';
import { PlanAuditoriaController } from './plan-auditoria.controller';
import { PlanAuditoriaService } from './plan-auditoria.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule],
  controllers: [PlanAuditoriaController],
  providers: [PlanAuditoriaService]
})
export class PlanAuditoriaModule {}
