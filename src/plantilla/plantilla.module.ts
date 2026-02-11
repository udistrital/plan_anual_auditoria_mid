import { Module } from '@nestjs/common';
import { PlantillaController } from './plantilla.controller';
import { PlantillaService } from './services/plantilla.service';
import { HttpModule } from '@nestjs/axios';
import { PlantillaPlanTrabajoService } from './services/plantilla-plan-trabajo.service';
import { PlantillaUtilsService } from '../utils/plantilla.utils';
import { PlantillaSolicitudInformacionService } from './services/plantilla-solicitud-informacion.service';
import { PlantillaCartaPresentacionService } from './services/plantilla-carta-presentacion.service';
import { PlantillaProgramaTrabajoService } from './services/plantilla-programa-trabajo.service';
import { PlantillaInformeSeguimientoService } from './services/plantilla-informe-seguimiento.service';
import { PlantillaInformeAuditoriaService } from './services/plantilla-informe-auditoria.service';

@Module({
  imports: [HttpModule],
  controllers: [PlantillaController],
  providers: [
    PlantillaCartaPresentacionService,
    PlantillaService,
    PlantillaSolicitudInformacionService,
    PlantillaPlanTrabajoService,
    PlantillaUtilsService,
    PlantillaProgramaTrabajoService,
    PlantillaInformeSeguimientoService,
    PlantillaInformeAuditoriaService,
  ],
})
export class PlantillaModule {}
