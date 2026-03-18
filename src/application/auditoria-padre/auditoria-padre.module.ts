import { Module } from '@nestjs/common';
import { AuditoriaPadreController } from './auditoria-padre.controller';
import { AuditoriaPadreService } from './auditoria-padre.service';
import { HttpModule } from '@nestjs/axios';
import { DominiosModule } from 'src/shared/utils/dominios/dominios.module';
import { AuditoriaOrdenadaModule } from 'src/shared/services/auditoria-ordenada/auditoria-ordenada.module';

@Module({
  imports: [HttpModule, DominiosModule, AuditoriaOrdenadaModule],
  controllers: [AuditoriaPadreController],
  providers: [AuditoriaPadreService],
  exports: [AuditoriaPadreService],
})
export class AuditoriaPadreModule {}
