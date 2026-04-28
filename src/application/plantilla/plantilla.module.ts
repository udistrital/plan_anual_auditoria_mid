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
import { PlantillasMidModule } from 'src/shared/services/plantillas-mid/plantillas-mid.module';
import { AuditoriaCrudModule } from 'src/shared/services/auditoria-crud/auditoria-crud.module';
import { ParametrosModule } from 'src/shared/services/parametros/parametros.module';
import { TercerosModule } from 'src/shared/services/terceros/terceros.module';
import { OikosModule } from 'src/shared/services/oikos/oikos.module';

@Module({
  imports: [
    DominiosModule,
    AuditoriaModule,
    PlantillasMidModule,
    AuditoriaCrudModule,
    ParametrosModule,
    TercerosModule,
    OikosModule
  ],
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
