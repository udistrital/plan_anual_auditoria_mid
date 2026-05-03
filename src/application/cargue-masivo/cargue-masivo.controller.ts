import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
  Get,
  Param,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { CargueMasivoService } from './cargue-masivo.service';
import { environment } from 'src/config/configuration';
import { NuxeoService } from 'src/shared/services/nuxeo.service';
import { AuditoriaPadreService } from '../auditoria-padre/auditoria-padre.service';
import { firstValueFrom } from 'rxjs';

@ApiTags('Cargue Masivo')
@Controller('cargue-masivo')
export class CargueMasivoController {
  constructor(
    private readonly cargueMasivoService: CargueMasivoService,
    private readonly nuxeoService: NuxeoService,
    private readonly auditoriaPadreService: AuditoriaPadreService,
  ) {}

  @Get('auditorias/plantilla')
  @ApiOperation({ summary: 'Descargar plantilla de auditorías' })
  @ApiResponse({ status: 500, description: 'Error interno.' })
  @ApiResponse({
    status: 200,
    description: 'Plantilla descargada exitosamente.',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            base64: {
              type: 'string',
              description: 'Archivo de plantilla en formato Base64.',
            },
          },
        },
      },
    },
  })
  async descargarPlantillaAuditorias(): Promise<{ base64: string }> {
    const response = await firstValueFrom(
      this.nuxeoService.obtenerPorUUID(
        environment.PLANTILLA_CARGUE_MASIVO_AUDITORIAS,
      ),
    );
    const plantillaConValidaciones =
      await this.cargueMasivoService.agregarValidaciones(response);
    return { base64: plantillaConValidaciones };
  }

  @Get('auditorias/plan/:planId')
  @ApiOperation({ summary: 'Descargar auditorías en formato Excel' })
  @ApiResponse({ status: 500, description: 'Error interno.' })
  @ApiParam({
    name: 'planId',
    required: true,
    description: 'ID del plan de auditoría.',
  })
  @ApiResponse({
    status: 200,
    description: 'Archivo de auditorías descargado exitosamente.',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            base64: {
              type: 'string',
              description: 'Archivo de auditorías en formato Base64.',
            },
          },
        },
      },
    },
  })
  async descargarAuditoriasExcel(
    @Param('planId') planId: string,
  ): Promise<{ base64: string }> {
    const ordenadas = await this.auditoriaPadreService.getAuditoriasOrdenadas(
      { query: `plan_auditoria_id:${planId}` },
    );
    const plantillaResponse = await firstValueFrom(
      this.nuxeoService.obtenerPorUUID(
        environment.PLANTILLA_CARGUE_MASIVO_AUDITORIAS,
      ),
    );
    if (!ordenadas || !ordenadas.Data)
      throw new HttpException(
        'No se encontraron auditorías para el plan especificado',
        HttpStatus.NOT_FOUND,
      );

    const tablaExportada =
      await this.cargueMasivoService.exportarAuditoriasExcel(
        ordenadas.Data,
        plantillaResponse,
      );
    return { base64: tablaExportada };
  }

  @Post('auditorias')
  @ApiOperation({ summary: 'Carga masiva de auditorías' })
  @ApiBody({
    description: 'Carga masiva de auditorías con datos en formato Base64.',
    schema: {
      type: 'object',
      properties: {
        base64data: {
          type: 'string',
          description: 'Archivo en formato Base64.',
        },
        complemento: { type: 'object', description: 'Datos complementarios.' },
      },
      required: ['base64data', 'complemento'],
    },
  })
  @ApiResponse({ status: 201, description: 'Carga masiva exitosa.' })
  @ApiResponse({ status: 400, description: 'Datos inválidos.' })
  @ApiResponse({ status: 500, description: 'Error interno.' })
  async cargueMasivo(@Body() cargaDatos: any): Promise<any> {
    const { base64data, complement: complemento } = cargaDatos;
    const estructura = await this.cargueMasivoService.crearEstructura(
      base64data,
      complemento,
    );
    const response = await this.cargueMasivoService.enviar(estructura);
    return response;
  }

  @Post('actividades')
  @ApiOperation({ summary: 'Carga masiva de actividades' })
  @ApiBody({
    description: 'Carga masiva de actividades con datos en formato Base64.',
    schema: {
      type: 'object',
      properties: {
        base64data: {
          type: 'string',
          description: 'Archivo en formato Base64.',
        },
        complemento: { type: 'object', description: 'Datos complementarios.' },
      },
      required: ['base64data', 'complemento'],
    },
  })
  @ApiResponse({ status: 201, description: 'Carga masiva exitosa.' })
  @ApiResponse({ status: 400, description: 'Datos inválidos.' })
  @ApiResponse({ status: 500, description: 'Error interno.' })
  async cargueMasivoActividades(@Body() cargaDatos: any): Promise<any> {
    const { base64data, complemento } = cargaDatos;
    const estructura =
      await this.cargueMasivoService.crearEstructuraActividad(
        base64data,
        complemento,
      );
    const response = await this.cargueMasivoService.enviar(estructura);
    return response;
  }
}
