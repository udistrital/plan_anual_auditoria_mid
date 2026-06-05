import { Module } from '@nestjs/common';
import { PlantillaController } from './plantilla.controller';
import { PlantillaService } from './services/plantilla.service';
import { PlantillaSolicitudInformacionService } from './services/plantilla-solicitud-informacion.service';
import { PlantillaCartaPresentacionService } from './services/plantilla-carta-presentacion.service';
import { PlantillaProgramaAuditoriaService } from './services/plantilla-programa-auditoria.service';
import { PlantillaInformeSeguimientoService } from './services/plantilla-informe-seguimiento.service';
import { PlantillaInformeAuditoriaService } from './services/plantilla-informe-auditoria.service';
import { PlantillaPlanMejoramientoService } from './services/plantilla-plan-mejoramiento.service';
import { DominiosModule } from 'src/shared/utils/dominios/dominios.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { ServicesModule } from 'src/shared/services/services.module';
import moment from 'moment';
// @ts-ignore
import 'moment/locale/es';

@Module({
  imports: [DominiosModule, AuditoriaModule, ServicesModule],
  controllers: [PlantillaController],
  providers: [
    PlantillaCartaPresentacionService,
    PlantillaService,
    PlantillaSolicitudInformacionService,
    PlantillaProgramaAuditoriaService,
    PlantillaInformeSeguimientoService,
    PlantillaInformeAuditoriaService,
    PlantillaPlanMejoramientoService,
    {
      provide: 'MOMENT',
      useFactory: () => {
        moment.locale('es');
        return moment;
      },
    },
  ],
})
export class PlantillaModule {}
