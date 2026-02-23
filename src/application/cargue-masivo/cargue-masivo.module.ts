import { Module } from '@nestjs/common';
import { CargueMasivoController } from './cargue-masivo.controller';
import { CargueMasivoService } from './cargue-masivo.service';
import { HttpModule } from '@nestjs/axios';
import { NuxeoModule } from 'src/shared/utils/nuxeo/nuxeo.module';

@Module({
  imports: [HttpModule, NuxeoModule],
  controllers: [CargueMasivoController],
  providers: [CargueMasivoService]
})
export class CargueMasivoModule {}
