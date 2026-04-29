import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AuditoriaOrdenadaService } from './auditoria-ordenada.service';
import { AuditoriaCrudModule } from '../auditoria-crud/auditoria-crud.module';

@Module({
  imports: [HttpModule, AuditoriaCrudModule],
  providers: [AuditoriaOrdenadaService],
  exports: [AuditoriaOrdenadaService],
})
export class AuditoriaOrdenadaModule {}
