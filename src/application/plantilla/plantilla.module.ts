import { Module } from '@nestjs/common';
import { PlantillaController } from './plantilla.controller';
import { PlantillaService } from './services/plantilla.service';
import { PlantillaPlanTrabajoService } from './services/plantilla-plan-trabajo.service';
import { PlantillaSolicitudInformacionService } from './services/plantilla-solicitud-informacion.service';
import { PlantillaCartaPresentacionService } from './services/plantilla-carta-presentacion.service';
import { PlantillaProgramaAuditoriaService } from './services/plantilla-programa-auditoria.service';
import { PlantillaInformeSeguimientoService } from './services/plantilla-informe-seguimiento.service';
import { PlantillaInformeAuditoriaService } from './services/plantilla-informe-auditoria.service';
import { DominiosModule } from 'src/shared/utils/dominios/dominios.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { ServicesModule } from 'src/shared/services/services.module';

@Module({
  imports: [DominiosModule, AuditoriaModule, ServicesModule],
  controllers: [PlantillaController],
  providers: [
    PlantillaCartaPresentacionService,
    PlantillaService,
    PlantillaSolicitudInformacionService,
    PlantillaPlanTrabajoService,
    PlantillaProgramaAuditoriaService,
    PlantillaInformeSeguimientoService,
    PlantillaInformeAuditoriaService,
  ],
})
export class PlantillaModule {}
