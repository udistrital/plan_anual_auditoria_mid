import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AuditoriaEstadoService } from './auditoria-estado.service';
import { AuditoriaEstadoController } from './auditoria-estado.controller';
import { AuditoriaCrudModule } from 'src/shared/services/auditoria-crud/auditoria-crud.module';

@Module({
  imports: [HttpModule, AuditoriaCrudModule],
  controllers: [AuditoriaEstadoController],
  providers: [AuditoriaEstadoService],
})
export class AuditoriaEstadoModule {}
