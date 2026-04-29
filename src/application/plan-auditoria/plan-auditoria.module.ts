import { Module } from '@nestjs/common';
import { PlanAuditoriaController } from './plan-auditoria.controller';
import { PlanAuditoriaService } from './plan-auditoria.service';
import { ServicesModule } from 'src/shared/services/services.module';

@Module({
  imports: [ServicesModule],
  controllers: [PlanAuditoriaController],
  providers: [PlanAuditoriaService],
})
export class PlanAuditoriaModule {}
