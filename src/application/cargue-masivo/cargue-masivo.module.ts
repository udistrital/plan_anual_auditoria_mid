import { Module } from '@nestjs/common';
import { CargueMasivoController } from './cargue-masivo.controller';
import { CargueMasivoService } from './cargue-masivo.service';
import { HttpModule } from '@nestjs/axios';
import { NuxeoModule } from 'src/shared/utils/nuxeo/nuxeo.module';
import { DominiosModule } from 'src/shared/utils/dominios/dominios.module';
import { AuditoriaModule } from 'src/auditoria/auditoria.module';

@Module({
  // TODO: In the future, the AuditoriaModule dependency should be removed by modularizing the ordenadas method to avoid coupling between modules.
  imports: [HttpModule, NuxeoModule, DominiosModule, AuditoriaModule],
  controllers: [CargueMasivoController],
  providers: [CargueMasivoService]
})
export class CargueMasivoModule {}
