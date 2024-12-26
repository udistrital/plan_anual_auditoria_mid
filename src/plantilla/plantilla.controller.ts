import { Controller, Get, Param } from '@nestjs/common';
import { PlantillaService } from './services/plantilla.service';
import { PlantillaPlanTrabajoService } from './services/plantilla-plan-trabajo.service';
@Controller('plantilla')
export class PlantillaController {
  constructor(
    private readonly plantillaService: PlantillaService,
    private plantillaPlanTrabajo: PlantillaPlanTrabajoService,
  ) {}

  @Get(':id')
  async getById(@Param('id') id: string) {
    return await this.plantillaService.getOne(id);
  }

  @Get('/plan-trabajo/:idAuditoria')
  async getPlantillaPlanTrabajo(@Param('idAuditoria') id: string) {
    return await this.plantillaPlanTrabajo.get(id);
  }
}
