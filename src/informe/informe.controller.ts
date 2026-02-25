import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  HttpStatus,
  Res,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { InformeService } from './informe.service';

@ApiTags('Informe')
@Controller('informe')
export class InformeController {
  constructor(private readonly informeService: InformeService) {}

  @Get(':id')
  @ApiOperation({ 
    summary: 'Obtener informe consolidado para edición',
    description: 'Retorna el informe con auditoría hallazgos y temas'
  })
  @ApiParam({ name: 'id', type: 'string', description: 'ID del informe (MongoDB ObjectId)' })
  @ApiResponse({ status: 200, description: 'Informe obtenido exitosamente con datos complementarios' })
  @ApiResponse({ status: 404, description: 'Informe no encontrado' })
  async getById(@Res() res: any, @Param('id') id: string) {
    try {
      const data = await this.informeService.getInformeCompleto(id);
      res.status(HttpStatus.OK).json({
        Success: true,
        Status: HttpStatus.OK,
        Message: 'Peticion Exitosa',
        Data: data
      });
    } catch (error) {
      res.status(error.status || HttpStatus.INTERNAL_SERVER_ERROR).json({
        Success: false,
        Status: error.status || HttpStatus.INTERNAL_SERVER_ERROR,
        Message: error.message || 'Error al obtener el informe',
        Data: null
      });
    }
  }

  @Get()
  @ApiOperation({ 
    summary: 'Obtener todos los informes',
    description: 'Lista informes con filtros opcionales y datos complementarios básicos'
  })
  @ApiResponse({ status: 200, description: 'Informes obtenidos exitosamente' })
  async getAll(@Res() res: any, @Query() queryParams: any) {
    try {
      const data = await this.informeService.getAll(queryParams);
      res.status(HttpStatus.OK).json(data);
    } catch (error) {
      res.status(HttpStatus.NOT_FOUND).json({
        Success: false,
        Status: HttpStatus.NOT_FOUND,
        Message: 'Error en servicio GetAll: sin datos o parámetro inválido',
        Data: error.message
      });
    }
  }

  @Get('auditoria/:auditoriaId')
  @ApiOperation({ 
    summary: 'Obtener informes por auditoría',
    description: 'Lista todos los informes activos de una auditoría específica'
  })
  @ApiParam({ name: 'auditoriaId', type: 'string', description: 'ID de la auditoría' })
  @ApiResponse({ status: 200, description: 'Informes de la auditoría obtenidos' })
  async getByAuditoria(@Res() res: any, @Param('auditoriaId') auditoriaId: string) {
    try {
      const data = await this.informeService.getByAuditoria(auditoriaId);
      res.status(HttpStatus.OK).json(data);
    } catch (error) {
      res.status(HttpStatus.NOT_FOUND).json({
        Success: false,
        Status: HttpStatus.NOT_FOUND,
        Message: 'Error al obtener informes de la auditoría',
        Data: error.message
      });
    }
  }

  @Put(':id')
  @ApiOperation({ 
    summary: 'Actualizar un informe',
    description: 'Actualiza los datos de un informe existente'
  })
  @ApiParam({ name: 'id', type: 'string', description: 'ID del informe' })
  @ApiResponse({ status: 200, description: 'Informe actualizado exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos' })
  @ApiResponse({ status: 404, description: 'Informe no encontrado' })
  async update(@Res() res: any, @Param('id') id: string, @Body() body: any) {
    try {
      const data = await this.informeService.update(id, body);
      res.status(HttpStatus.OK).json(data);
    } catch (error) {
      res.status(error.status || HttpStatus.BAD_REQUEST).json({
        Success: false,
        Status: error.status || HttpStatus.BAD_REQUEST,
        Message: error.message || 'Error en servicio Put: datos incorrectos o inválidos',
        Data: null
      });
    }
  }

}