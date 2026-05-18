import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PlanMejoramientoAuditorController } from './plan-mejoramiento-auditor.controller';
import { PlanMejoramientoAuditorService } from './plan-mejoramiento-auditor.service';
import { AuditoriaCrudModule } from 'src/shared/services/auditoria-crud/auditoria-crud.module';

@Module({
  imports: [HttpModule, AuditoriaCrudModule],
  controllers: [PlanMejoramientoAuditorController],
  providers: [PlanMejoramientoAuditorService],
})
export class PlanMejoramientoAuditorModule {}
