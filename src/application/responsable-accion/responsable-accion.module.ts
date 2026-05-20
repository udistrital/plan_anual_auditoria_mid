import { Module } from '@nestjs/common';
import { ResponsableAccionController } from './responsable-accion.controller';
import { ResponsableAccionService } from './responsable-accion.service';
import { ServicesModule } from 'src/shared/services/services.module';
import { DominiosModule } from 'src/shared/utils/dominios/dominios.module';

@Module({
  imports: [ServicesModule, DominiosModule],
  controllers: [ResponsableAccionController],
  providers: [ResponsableAccionService],
})
export class ResponsableAccionModule {}
