import { Module } from '@nestjs/common';
import { ResponsableAccionController } from './responsable-accion.controller';
import { ResponsableAccionService } from './responsable-accion.service';
import { AuditoriaCrudModule } from 'src/shared/services/auditoria-crud/auditoria-crud.module';
import { DominiosModule } from 'src/shared/utils/dominios/dominios.module';

@Module({
  imports: [AuditoriaCrudModule, DominiosModule],
  controllers: [ResponsableAccionController],
  providers: [ResponsableAccionService],
})
export class ResponsableAccionModule {}
