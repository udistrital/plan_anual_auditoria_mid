import { Module } from '@nestjs/common';
import { CargueMasivoController } from './cargue-masivo.controller';
import { CargueMasivoService } from './cargue-masivo.service';
import { HttpModule } from '@nestjs/axios';
import { ServicesModule } from 'src/shared/services/services.module';
import { DominiosModule } from 'src/shared/utils/dominios/dominios.module';
import { AuditoriaPadreModule } from '../auditoria-padre/auditoria-padre.module';

@Module({
  imports: [HttpModule, ServicesModule, DominiosModule, AuditoriaPadreModule],
  controllers: [CargueMasivoController],
  providers: [CargueMasivoService],
})
export class CargueMasivoModule {}
