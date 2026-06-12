import { Module } from '@nestjs/common';
import { AccionMejoraController } from './accion-mejora.controller';
import { AccionMejoraService } from './accion-mejora.service';
import { ServicesModule } from 'src/shared/services/services.module';
import { DominiosModule } from 'src/shared/utils/dominios/dominios.module';

@Module({
  imports: [ServicesModule, DominiosModule],
  controllers: [AccionMejoraController],
  providers: [AccionMejoraService],
})
export class AccionMejoraModule {}
