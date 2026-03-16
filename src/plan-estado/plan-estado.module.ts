import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PlanEstadoService } from './plan-estado.service';
import { PlanEstadoController } from './plan-estado.controller';
import { AuditoriaCrudModule } from 'src/shared/services/auditoria-crud/auditoria-crud.module';

@Module({
  imports: [HttpModule, AuditoriaCrudModule],
  controllers: [PlanEstadoController],
  providers: [PlanEstadoService],
})
export class PlanEstadoModule {}
