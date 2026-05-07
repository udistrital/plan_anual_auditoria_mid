import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AuditoriaCrudService } from './auditoria-crud.service';
import { AuditoriaOrdenadaService } from './auditoria-ordenada.service';
import { TercerosHelperService } from './terceros-helper.service';
import { TercerosService } from './terceros.service';
import { PlantillasMidService } from './plantillas-mid.service';
import { ParametrosService } from './parametros.service';
import { OikosService } from './oikos.service';
import { NuxeoService } from './nuxeo.service';
import { LoggerService } from './logger.service';
import { GeneracionAuditoriaService } from './generacion-auditoria.service';

@Module({
  imports: [HttpModule],
  providers: [
    AuditoriaCrudService,
    AuditoriaOrdenadaService,
    TercerosService,
    TercerosHelperService,
    PlantillasMidService,
    ParametrosService,
    OikosService,
    NuxeoService,
    LoggerService,
    GeneracionAuditoriaService
  ],
  exports: [
    AuditoriaCrudService,
    AuditoriaOrdenadaService,
    TercerosService,
    TercerosHelperService,
    PlantillasMidService,
    ParametrosService,
    OikosService,
    NuxeoService,
    LoggerService,
    GeneracionAuditoriaService
  ],
})
export class ServicesModule {}
