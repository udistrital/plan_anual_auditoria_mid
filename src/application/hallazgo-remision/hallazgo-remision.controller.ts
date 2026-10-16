import { Controller, Get, HttpStatus, Param, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { HallazgoRemisionService } from './hallazgo-remision.service';

@ApiTags('Hallazgo Remisión')
@Controller('hallazgo-remision')
export class HallazgoRemisionController {
  constructor(private readonly hallazgoRemisionService: HallazgoRemisionService) {}

  @Get()
  @ApiOperation({ summary: 'Obtiene todas las remisiones de hallazgos.' })
  @ApiQuery({
    name: 'filter',
    required: false,
    description: 'Filtro opcional.',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Lista obtenida con éxito.' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No se encontraron remisiones.' })
  async getAll(@Query() queryParams: any) {
    return this.hallazgoRemisionService.getAll(queryParams);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtiene una remisión de hallazgo por ID.' })
  @ApiParam({
    name: 'id',
    required: true,
    description: 'ID de la remisión del hallazgo.',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Remisión obtenida con éxito.' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No se encontró la remisión.' })
  async getById(@Param('id') id: string) {
    return this.hallazgoRemisionService.getOne(id);
  }
}
