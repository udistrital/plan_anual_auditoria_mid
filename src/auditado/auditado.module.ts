import { Module } from '@nestjs/common';
import { AuditadoService } from './auditado.service';
import { AuditadoController } from './auditado.controller';
import { ServicesModule } from 'src/shared/services/services.module';

@Module({
  imports: [ServicesModule],
  controllers: [AuditadoController],
  providers: [AuditadoService],
})
export class AuditadoModule {}
