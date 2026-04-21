import { Module } from '@nestjs/common';
import { AuditadoService } from './auditado.service';
import { AuditadoController } from './auditado.controller';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule],
  controllers: [AuditadoController],
  providers: [AuditadoService],
})
export class AuditadoModule {}
