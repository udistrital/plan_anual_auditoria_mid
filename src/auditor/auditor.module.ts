import { Module } from '@nestjs/common';
import { AuditorController } from './auditor.controller';
import { AuditorService } from './auditor.service';
import { HttpModule } from '@nestjs/axios';
import { AuditoriaCrudModule } from 'src/shared/services/auditoria-crud/auditoria-crud.module';
import { TercerosModule } from 'src/shared/services/terceros/terceros.module';

@Module({
  imports: [HttpModule, AuditoriaCrudModule, TercerosModule],
  controllers: [AuditorController],
  providers: [AuditorService],
  exports: [AuditorService],
})
export class AuditorModule {}
