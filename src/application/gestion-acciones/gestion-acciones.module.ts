import { Module } from '@nestjs/common';
import { GestionAccionesController } from './gestion-acciones.controller';
import { GestionAccionesService } from './gestion-acciones.service';
import { ServicesModule } from 'src/shared/services/services.module';
import { DominiosModule } from 'src/shared/utils/dominios/dominios.module';

@Module({
  imports: [ServicesModule, DominiosModule],
  controllers: [GestionAccionesController],
  providers: [GestionAccionesService],
})
export class GestionAccionesModule {}
