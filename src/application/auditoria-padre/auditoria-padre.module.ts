import { Module } from '@nestjs/common';
import { AuditoriaPadreController } from './auditoria-padre.controller';
import { AuditoriaPadreService } from './auditoria-padre.service';
import { DominiosModule } from 'src/shared/utils/dominios/dominios.module';
import { ServicesModule } from 'src/shared/services/services.module';

@Module({
  imports: [DominiosModule, ServicesModule],
  controllers: [AuditoriaPadreController],
  providers: [AuditoriaPadreService],
  exports: [AuditoriaPadreService],
})
export class AuditoriaPadreModule {}
