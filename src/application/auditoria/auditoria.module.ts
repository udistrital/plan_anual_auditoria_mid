import { Module } from '@nestjs/common';
import { AuditoriaController } from './auditoria.controller';
import { AuditoriaService } from './auditoria.service';
import { HttpModule } from '@nestjs/axios';
import { AuditorModule } from '../../auditor/auditor.module';
import { DominiosModule } from 'src/shared/utils/dominios/dominios.module';

@Module({
  imports: [HttpModule, AuditorModule, DominiosModule],
  controllers: [AuditoriaController],
  providers: [AuditoriaService],
  exports: [AuditoriaService],
})
export class AuditoriaModule {}
