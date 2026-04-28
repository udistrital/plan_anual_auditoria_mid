import { Module } from '@nestjs/common';
import { AuditadoService } from './auditado.service';
import { AuditadoController } from './auditado.controller';
import { HttpModule } from '@nestjs/axios';
import { TercerosModule } from 'src/shared/services/terceros/terceros.module';

@Module({
  imports: [HttpModule, TercerosModule],
  controllers: [AuditadoController],
  providers: [AuditadoService],
})
export class AuditadoModule {}
