import { Module } from '@nestjs/common';
import { AuditorController } from './auditor.controller';
import { AuditorService } from './auditor.service';
import { HttpModule } from '@nestjs/axios';
import { AuditoriaCrudModule } from 'src/shared/services/auditoria-crud/auditoria-crud.module';

@Module({
  imports: [HttpModule, AuditoriaCrudModule],
  controllers: [AuditorController],
  providers: [AuditorService],
  exports: [AuditorService],
})
export class AuditorModule {}
