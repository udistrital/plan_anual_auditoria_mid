import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuditoriaExternaService } from './auditoria-externa.service';
import { RegistrarAuditoriaExternaDto } from './dto/registrar-auditoria-externa.dto';

@ApiTags('Auditoría externa')
@Controller('auditoria-externa')
export class AuditoriaExternaController {
  constructor(
    private readonly auditoriaExternaService: AuditoriaExternaService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Registrar una auditoría externa con su informe y hallazgos',
    description:
      'Valida todo y lo guarda en una sola operación: auditoría, estado, hallazgos, informe final (PDF ya subido a Nuxeo) y el esqueleto del plan de mejoramiento con el auditor como líder. Todo o nada: si un paso falla se revierte lo creado.',
  })
  @ApiBody({ type: RegistrarAuditoriaExternaDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: '`Data` trae `auditoria_externa_id` y `plan_mejoramiento_id`.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description:
      'Datos inválidos. El detalle por campo y fila viene en `details.errores`.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'El rol del usuario no puede registrar auditorías externas.',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description:
      'Ya existe una auditoría del mismo ente, nombre y fecha de informe.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_GATEWAY,
    description: 'Falló el servicio CRUD; no se guardó nada.',
  })
  async registrar(@Body() body: RegistrarAuditoriaExternaDto) {
    return this.auditoriaExternaService.registrar(body);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar las auditorías externas (más recientes primero)',
  })
  @ApiQuery({
    name: 'vigencia_id',
    required: false,
    description: 'Id de la vigencia.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Registros por página (1 a 100, por defecto 20).',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    description: 'Desplazamiento (por defecto 0).',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista (puede ser vacía) con `MetaData.Count`.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Parámetros inválidos.',
  })
  async listar(@Query() query: Record<string, any>) {
    return this.auditoriaExternaService.listar(query);
  }

  @Get(':id')
  @ApiOperation({
    summary:
      'Consultar una auditoría externa con sus hallazgos, informe y plan',
  })
  @ApiParam({
    name: 'id',
    required: true,
    description: 'Id (ObjectId) de la auditoría externa.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Datos, hallazgos (con nombres), informe final y plan de mejoramiento.',
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Id inválido.' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'La auditoría externa no existe.',
  })
  async obtener(@Param('id') id: string) {
    return this.auditoriaExternaService.obtener(id);
  }
}
