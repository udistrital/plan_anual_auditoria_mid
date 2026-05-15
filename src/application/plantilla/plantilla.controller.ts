import {
  Controller,
  Get,
  HttpStatus,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { PlantillaService } from './services/plantilla.service';
import { PlantillaSolicitudInformacionService } from './services/plantilla-solicitud-informacion.service';
import { PlantillaCartaPresentacionService } from './services/plantilla-carta-presentacion.service';
import { PlantillaProgramaAuditoriaService } from './services/plantilla-programa-auditoria.service';
import { PlantillaInformeSeguimientoService } from './services/plantilla-informe-seguimiento.service';
import { PlantillaInformeAuditoriaService } from './services/plantilla-informe-auditoria.service';

@ApiTags('Plantilla')
@Controller('plantilla')
export class PlantillaController {
  constructor(
    private readonly plantillaService: PlantillaService,
    private readonly plantillaSolicitudInformacion: PlantillaSolicitudInformacionService,
    private readonly plantillaCartaPresentacion: PlantillaCartaPresentacionService,
    private readonly plantillaProgramaAuditoria: PlantillaProgramaAuditoriaService,
    private readonly plantillaInformeSeguimiento: PlantillaInformeSeguimientoService,
    private readonly plantillaInformeAuditoria: PlantillaInformeAuditoriaService,
  ) {}

  @Get(':id')
  @ApiOperation({ summary: 'Obtener plantilla por ID' })
  @ApiParam({ name: 'id', description: 'ID de la plantilla' })
  @ApiQuery({
    name: 'conEspeciales',
    required: false,
    default: false,
    type: Boolean,
    description: 'Incluir caracteres especiales en la plantilla',
  })
  @ApiQuery({
    name: 'auditoria-padre',
    required: false,
    default: false,
    type: Boolean,
    description:
      'Usar la auditoría padre en la plantilla en lugar de la colección de auditorías original',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Plantilla encontrada.' })
  async getById(
    @Param('id') id: string,
    @Query('conEspeciales') conEspeciales?: string,
    @Query('auditoria-padre') auditoriaPadre?: string,
  ) {
    if (conEspeciales == null) conEspeciales = 'false';

    if (auditoriaPadre == null) auditoriaPadre = 'false';

    return this.plantillaService.getOne(
      id,
      conEspeciales === 'true',
      auditoriaPadre === 'true',
    );
  }

  @Get('/:tipo/:idAuditoria')
  @ApiOperation({
    summary: 'Obtener plantilla dinámica según el tipo de auditoría',
  })
  @ApiParam({
    name: 'tipo',
    description:
      'Tipo de la plantilla (ej: plan-trabajo, solicitud-informacion, carta-presentacion, programa-trabajo, informe-seguimiento, informe-auditoria)',
  })
  @ApiParam({ name: 'idAuditoria', description: 'ID de la auditoría' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Plantilla generada exitosamente.' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Tipo de plantilla no encontrado.' })
  async getPlantilla(
    @Param('tipo') tipo: string,
    @Param('idAuditoria') id: string,
  ) {
    switch (tipo) {
      case 'solicitud-informacion':
        return this.plantillaSolicitudInformacion.get(id);
      case 'carta-presentacion':
        return this.plantillaCartaPresentacion.get(id);
      case 'programa-auditoria':
        return this.plantillaProgramaAuditoria.get(id);
      case 'informe-seguimiento':
        return this.plantillaInformeSeguimiento.get(id);
      case 'informe-auditoria':
        return this.plantillaInformeAuditoria.get(id);
      default:
        throw new NotFoundException(
          `No se encontró el tipo de plantilla: ${tipo}`,
        );
    }
  }

  @Get('docx/:tipo/:idAuditoria')
  @ApiOperation({
    summary: 'Obtener plantilla dinámica según el tipo de auditoría en formato DOCX',
  })
  @ApiParam({
    name: 'tipo',
    description:
      'Tipo de la plantilla (ej: plan-trabajo, solicitud-informacion, carta-presentacion, programa-trabajo, informe-seguimiento, informe-auditoria)',
  })
  @ApiParam({ name: 'idAuditoria', description: 'ID de la auditoría' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Plantilla generada exitosamente.' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Tipo de plantilla no encontrado.' })
  async getPlantillaDOCX(
    @Param('tipo') tipo: string,
    @Param('idAuditoria') id: string,
  ) {
    // Como actualmente sólo hay una plantilla, se usa condicional.
    // Si en el futuro se añaden más, refactorizar a switch.
    if (tipo !== 'carta-presentacion') {
      throw new NotFoundException(
        `No se encontró el tipo de plantilla para descargar DOCX: ${tipo}`,
      );
    }
    return this.plantillaCartaPresentacion.getDOCX(id);
  }
}
