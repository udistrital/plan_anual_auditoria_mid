import { Module } from '@nestjs/common';
import { AuditoriaController } from './auditoria.controller';
import { AuditoriaService } from './auditoria.service';
import { AuditorModule } from '../../auditor/auditor.module';
import { DominiosModule } from 'src/shared/utils/dominios/dominios.module';
import { ServicesModule } from 'src/shared/services/services.module';

@Module({
  imports: [AuditorModule, DominiosModule, ServicesModule],
  controllers: [AuditoriaController],
  providers: [AuditoriaService],
  exports: [AuditoriaService],
})
export class AuditoriaModule {}
