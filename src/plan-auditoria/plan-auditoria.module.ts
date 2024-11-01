import { Module } from '@nestjs/common';
import { PlanAuditoriaController } from './plan-auditoria.controller';
import { PlanAuditoriaService } from './plan-auditoria.service';

@Module({
  controllers: [PlanAuditoriaController],
  providers: [PlanAuditoriaService]
})
export class PlanAuditoriaModule {}
