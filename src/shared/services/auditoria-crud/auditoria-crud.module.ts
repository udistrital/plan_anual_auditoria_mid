import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AuditoriaCrudService } from './auditoria-crud.service';

@Module({
    imports: [HttpModule],
    providers: [AuditoriaCrudService],
    exports: [AuditoriaCrudService]
})
export class AuditoriaCrudModule {}
