import { Module } from '@nestjs/common';
import { ServicesModule } from 'src/shared/services/services.module';
import { DominiosModule } from 'src/shared/utils/dominios/dominios.module';
import { ComentarioAccionController } from './comentario-accion.controller';
import { ComentarioAccionService } from './comentario-accion.service';

@Module({
  imports: [ServicesModule, DominiosModule],
  controllers: [ComentarioAccionController],
  providers: [ComentarioAccionService],
})
export class ComentarioAccionModule {}
