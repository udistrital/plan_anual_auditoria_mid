import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { PlantillaService } from './services/plantilla.service';
import { PlantillaPlanTrabajoService } from './services/plantilla-plan-trabajo.service';

@ApiTags('Plantilla')
@Controller('plantilla')
export class PlantillaController {
  constructor(
    private readonly plantillaService: PlantillaService,
    private plantillaPlanTrabajo: PlantillaPlanTrabajoService,
  ) {}

  @Get(':id')
  @ApiOperation({ summary: 'Obtener plantilla por ID' })
  @ApiParam({ name: 'id', description: 'ID de la plantilla' })
  @ApiResponse({ status: 200, description: 'Plantilla encontrada.' })
  async getById(@Param('id') id: string) {
    return this.plantillaService.getOne(id);
  }

  @Get('/plan-trabajo/:idAuditoria')
  @ApiOperation({ summary: 'Obtener plantilla de plan de trabajo' })
  @ApiParam({ name: 'idAuditoria', description: 'ID de la auditoría' })
  @ApiResponse({ status: 200, description: 'Plan de trabajo encontrado.' })
  async getPlantillaPlanTrabajo(@Param('idAuditoria') id: string) {
    return this.plantillaPlanTrabajo.get(id);
  }
}
