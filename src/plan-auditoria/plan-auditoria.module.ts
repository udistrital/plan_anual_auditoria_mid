import { Module } from '@nestjs/common';
import { PlanAuditoriaController } from './plan-auditoria.controller';
import { PlanAuditoriaService } from './plan-auditoria.service';
import { HttpModule } from '@nestjs/axios';
import { AuditoriaCrudModule } from 'src/shared/services/auditoria-crud/auditoria-crud.module';

@Module({
  imports: [HttpModule, AuditoriaCrudModule],
  controllers: [PlanAuditoriaController],
  providers: [PlanAuditoriaService],
})
export class PlanAuditoriaModule {}
