import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { PlantillaService } from './services/plantilla.service';
import { PlantillaPlanTrabajoService } from './services/plantilla-plan-trabajo.service';
import { PlantillaSolicitudInformacionService } from './services/plantilla-solicitud-informacion.service';
import { PlantillaCartaPresentacionService } from './services/plantilla-carta-presentacion.service';
import { PlantillaProgramaTrabajoService } from './services/plantilla-programa-trabajo.service';

@ApiTags('Plantilla')
@Controller('plantilla')
export class PlantillaController {
  constructor(
    private readonly plantillaService: PlantillaService,
    private readonly plantillaPlanTrabajo: PlantillaPlanTrabajoService,
    private readonly plantillaSolicitudInformacion: PlantillaSolicitudInformacionService,
    private readonly plantillaCartaPresentacion: PlantillaCartaPresentacionService,
    private readonly plantillaProgramaTrabajo: PlantillaProgramaTrabajoService,
  ) {}

  @Get(':id')
  @ApiOperation({ summary: 'Obtener plantilla por ID' })
  @ApiParam({ name: 'id', description: 'ID de la plantilla' })
  @ApiResponse({ status: 200, description: 'Plantilla encontrada.' })
  async getById(@Param('id') id: string) {
    return this.plantillaService.getOne(id);
  }

  @Get('/:tipo/:idAuditoria')
  @ApiOperation({
    summary: 'Obtener plantilla dinámica según el tipo de auditoría',
  })
  @ApiParam({
    name: 'tipo',
    description:
      'Tipo de la plantilla (ej: plan-trabajo, solicitud-informacion, carta-presentacion)',
  })
  @ApiParam({ name: 'idAuditoria', description: 'ID de la auditoría' })
  @ApiResponse({ status: 200, description: 'Plantilla generada exitosamente.' })
  @ApiResponse({ status: 404, description: 'Tipo de plantilla no encontrado.' })
  async getPlantilla(
    @Param('tipo') tipo: string,
    @Param('idAuditoria') id: string,
  ) {
    switch (tipo) {
      case 'plan-trabajo':
        return this.plantillaPlanTrabajo.get(id);
      case 'solicitud-informacion':
        return this.plantillaSolicitudInformacion.get(id);
      case 'carta-presentacion':
        return this.plantillaCartaPresentacion.get(id);
      case 'programa-trabajo':
        return this.plantillaProgramaTrabajo.get(id);
      default:
        throw new NotFoundException(
          `No se encontró el tipo de plantilla: ${tipo}`,
        );
    }
  }
}
