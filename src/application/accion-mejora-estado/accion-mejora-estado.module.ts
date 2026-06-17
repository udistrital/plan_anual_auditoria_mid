import { Module } from '@nestjs/common';
import { AccionMejoraEstadoController } from './accion-mejora-estado.controller';
import { AccionMejoraEstadoService } from './accion-mejora-estado.service';
import { ServicesModule } from 'src/shared/services/services.module';
import { DominiosModule } from 'src/shared/utils/dominios/dominios.module';

@Module({
  imports: [ServicesModule, DominiosModule],
  controllers: [AccionMejoraEstadoController],
  providers: [AccionMejoraEstadoService],
})
export class AccionMejoraEstadoModule {}
