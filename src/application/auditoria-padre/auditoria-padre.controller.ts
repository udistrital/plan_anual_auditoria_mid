import {
  Controller,
  Get,
  Delete,
  Param,
  Query,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { AuditoriaPadreService } from './auditoria-padre.service';

@ApiTags('Auditoria Padre')
@Controller('auditoria-padre')
export class AuditoriaPadreController {
  constructor(
    private readonly auditoriaPadreService: AuditoriaPadreService,
  ) {}

  @Get('ordenadas')
  @ApiOperation({ summary: 'Obtener auditorías padre ordenadas' })
  @ApiQuery({
    name: 'plan_auditoria_id',
    required: true,
    description: 'ID del plan de auditoría (obligatorio).',
  })
  @ApiQuery({
    name: 'orderBy',
    required: false,
    description: 'Campo de orden.',
  })
  @ApiQuery({
    name: 'orderDirection',
    required: false,
    description: 'Dirección (ASC o DESC).',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Auditorías padre obtenidas.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Parámetros inválidos.',
  })
  async getAuditoriasOrdenadas(@Query() queryParams: any) {
    return this.auditoriaPadreService.getAuditoriasOrdenadas(
      queryParams,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todas las auditorías padre' })
  @ApiQuery({
    name: 'filter',
    required: false,
    description: 'Filtro opcional.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Auditorías padre obtenidas.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Sin resultados.',
  })
  async getAll(@Query() queryParams: any) {
    return this.auditoriaPadreService.getAll(queryParams);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener auditoría padre por ID' })
  @ApiParam({
    name: 'id',
    required: true,
    description: 'ID de auditoría padre.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Auditoría padre obtenida.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Auditoría padre no encontrada.',
  })
  async getById(@Param('id') id: string) {
    return this.auditoriaPadreService.getOne(id);
  }

  @Delete(':id/:planId')
  @ApiOperation({ summary: 'Eliminar auditoría padre lógicamente' })
  @ApiParam({
    name: 'id',
    required: true,
    description: 'ID de auditoría padre.',
  })
  @ApiParam({
    name: 'planId',
    required: true,
    description: 'ID del plan de auditoría.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Auditoría padre eliminada.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Parámetros inválidos.',
  })
  async delete(
    @Param('id') id: string,
    @Param('planId') planId: string,
  ) {
    return this.auditoriaPadreService.deleteAuditoriaPadre(
      id,
      planId,
    );
  }
}