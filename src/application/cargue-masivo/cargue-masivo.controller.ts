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
  ApiParam,
} from '@nestjs/swagger';
import { CargueMasivoService } from './cargue-masivo.service';
import { environment } from 'src/config/configuration';
import { NuxeoService } from 'src/shared/services/nuxeo.service';
import { AuditoriaPadreService } from '../auditoria-padre/auditoria-padre.service';
import { firstValueFrom } from 'rxjs';
import { ConstruirExcelInterface } from 'src/shared/utils/construirExcel';

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
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Error interno.' })
  @ApiResponse({
    status: HttpStatus.OK,
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
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Error interno.' })
  @ApiParam({
    name: 'planId',
    required: true,
    description: 'ID del plan de auditoría.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
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
    if (ordenadas?.Data == null)
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

  @Post('exportar-excel')
  @ApiOperation({ summary: 'Exportar libro a un archivo de Excel' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Error interno.' })
  @ApiBody({
    description: 'Datos necesarios para generar el plan de mejoramiento.',
    schema: {
      type: 'object',
      properties: {
        worksheets: {
          type: 'array',
          description: 'Lista de hojas de cálculo a generar.',
          items: {
            type: 'object',
            description: 'Datos de una hoja de cálculo, incluyendo su nombre y las filas a incluir.',
            properties: {
              name: {
                type: 'string',
                description: 'Nombre de la hoja de cálculo.',
              },
              rows: {
                type: 'array',
                description: 'Filas de la hoja de cálculo',
                items: {
                  type: 'array',
                  description: 'Una fila de la hoja de cálculo',
                  items: {
                    type: 'string',
                    description: 'Valor de la celda en formato string.',
                  },
                },
              },       
            },
          }
        }
      }
    },
    examples: {
      example1: {
        summary: 'Ejemplo de datos para generar un libro de Excel con dos hojas de cálculo.',
        value: {
          worksheets: [
            {
              name: 'Hoja1',
              rows: [
                ['Encabezado1', 'Encabezado2', 'Encabezado3'],
                ['Dato1', 'Dato2', 'Dato3'],
                ['Dato4', 'Dato5', 'Dato6']
              ]
            },
            {
              name: 'Hoja2',
              rows: [
                ['ColumnaA', 'ColumnaB'],
                ['ValorA1', 'ValorB1'],
                ['ValorA2', 'ValorB2']
              ]
            }
          ]
        }
      }
    }
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Archivo de plan de mejoramiento descargado exitosamente.',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            base64: {
              type: 'string',
              description: 'Archivo de plan de mejoramiento en formato Base64.',
            },
          },
        },
      },
    },
  })
  async exportarLibroExcel(
    @Body() datos: ConstruirExcelInterface,
  ): Promise<{ base64: string }> {
    try {
      const tablaExportada = await this.cargueMasivoService.exportarLibroExcel(datos);
      return { base64: tablaExportada };
    } catch (error) {
      console.error('Error al exportar el libro a Excel:', error);
      throw new HttpException(
        'Error al exportar el libro a Excel',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
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
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Carga masiva exitosa.' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Datos inválidos.' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Error interno.' })
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
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Carga masiva exitosa.' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Datos inválidos.' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Error interno.' })
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
