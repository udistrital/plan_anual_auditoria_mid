import { Controller, Get, Param, HttpStatus, Res, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { InformeService } from './informe.service';

@ApiTags('Informe')
@Controller('informe')
export class InformeController {
  constructor(private readonly informeService: InformeService) {}

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener informe consolidado para edición',
    description: 'Retorna el informe con auditoría hallazgos y temas',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    description: 'ID del informe (MongoDB ObjectId)',
  })
  @ApiResponse({
    status: 200,
    description: 'Informe obtenido exitosamente con datos complementarios',
  })
  @ApiResponse({ status: 404, description: 'Informe no encontrado' })
  async getById(@Res() res: any, @Param('id') id: string) {
    const data = await this.informeService.getInformeCompleto(id);
    res.status(HttpStatus.OK).json({
      Success: true,
      Status: HttpStatus.OK,
      Message: 'Peticion Exitosa',
      Data: data,
    });
  }

  @Get()
  @ApiOperation({
    summary: 'Obtener todos los informes',
    description:
      'Lista informes con filtros opcionales y datos complementarios básicos',
  })
  @ApiResponse({ status: 200, description: 'Informes obtenidos exitosamente' })
  async getAll(@Res() res: any, @Query() queryParams: any) {
    const data = await this.informeService.getAll(queryParams);
    res.status(HttpStatus.OK).json(data);
  }

  @Get('auditoria/:auditoriaId')
  @ApiOperation({
    summary: 'Obtener informes por auditoría',
    description: 'Lista todos los informes activos de una auditoría específica',
  })
  @ApiParam({
    name: 'auditoriaId',
    type: 'string',
    description: 'ID de la auditoría',
  })
  @ApiResponse({
    status: 200,
    description: 'Informes de la auditoría obtenidos',
  })
  async getByAuditoria(
    @Res() res: any,
    @Param('auditoriaId') auditoriaId: string,
  ) {
    const data = await this.informeService.getByAuditoria(auditoriaId);
    res.status(HttpStatus.OK).json(data);
  }
}
