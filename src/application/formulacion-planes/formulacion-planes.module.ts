import { Module } from '@nestjs/common';
import { FormulacionPlanesController } from './formulacion-planes.controller';
import { FormulacionPlanesService } from './formulacion-planes.service';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { ServicesModule } from 'src/shared/services/services.module';
import { DominiosModule } from 'src/shared/utils/dominios/dominios.module';

@Module({
  imports: [AuditoriaModule, ServicesModule, DominiosModule],
  controllers: [FormulacionPlanesController],
  providers: [FormulacionPlanesService],
})
export class FormulacionPlanesModule {}
