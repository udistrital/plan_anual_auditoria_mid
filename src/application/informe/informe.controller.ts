import { Controller, Get, Put, Param, HttpStatus, Query } from '@nestjs/common';
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
    status: HttpStatus.OK,
    description: 'Informe obtenido exitosamente con datos complementarios',
  })
  @ApiResponse({ status: 404, description: 'Informe no encontrado' })
  async getById(@Param('id') id: string) {
    return this.informeService.getInformeCompleto(id);
  }

  @Get()
  @ApiOperation({
    summary: 'Obtener todos los informes',
    description:
      'Lista informes con filtros opcionales y datos complementarios básicos',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Informes obtenidos exitosamente' })
  async getAll(@Query() queryParams: any) {
    return await this.informeService.getAll(queryParams);

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
    status: HttpStatus.OK,
    description: 'Informes de la auditoría obtenidos',
  })
  async getByAuditoria(
    @Param('auditoriaId') auditoriaId: string,
  ) {
    return await this.informeService.getByAuditoria(auditoriaId);
  }

  @Put('auditoria/:auditoriaId/numeracion-hallazgo')
  @ApiOperation({
    summary: 'Asignar/recalcular la numeración de hallazgos del informe',
    description:
      'Calcula y persiste el número jerárquico {tema}.{subtema}.{hallazgo} (no_hallazgo) en los hallazgos activos del informe de la auditoría. Idempotente.',
  })
  @ApiParam({
    name: 'auditoriaId',
    type: 'string',
    description: 'ID de la auditoría',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Resumen: { total, sellados, fallidos }',
  })
  @ApiResponse({ status: 404, description: 'Informe no encontrado' })
  async actualizarNumeracionHallazgo(@Param('auditoriaId') auditoriaId: string) {
    return await this.informeService.sellarHallazgos(auditoriaId);
  }
}
