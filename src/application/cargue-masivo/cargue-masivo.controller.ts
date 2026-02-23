import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
  Get,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { CargueMasivoService } from './cargue-masivo.service';
import axios from 'axios';
import { environment } from 'src/config/configuration';
import { NuxeoService } from 'src/shared/utils/nuxeo/nuxeo.service';

@ApiTags('Cargue Masivo')
@Controller('cargue-masivo')
export class CargueMasivoController {
  constructor(
    private readonly cargueMasivoService: CargueMasivoService,
    private readonly nuxeoService: NuxeoService,
  ) {}

  private cargueMasivoUrl = `${environment.CARGUE_MASIVO_SERVERLESS_MID}registro-datos-archivo`;

  @Get('auditorias/plantilla')
  @ApiOperation({ summary: 'Descargar plantilla de auditorías' })
  @ApiResponse({ status: 200, description: 'Plantilla descargada exitosamente.' })
  @ApiResponse({ status: 500, description: 'Error interno.' })
  async descargarPlantillaAuditorias(): Promise<any> {
    try {
      const plantillaBase64 = await this.nuxeoService.obtenerPorUUID(environment.PLANTILLA_CARGUE_MASIVO_AUDITORIAS);
      const response = await this.cargueMasivoService.agregarValidaciones(plantillaBase64);
      return response;
    } catch (error) {
      console.error('Error al descargar la plantilla:', error);
      throw new HttpException(
        'Error al descargar la plantilla',
        HttpStatus.INTERNAL_SERVER_ERROR,
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
  @ApiResponse({ status: 201, description: 'Carga masiva exitosa.' })
  @ApiResponse({ status: 400, description: 'Datos inválidos.' })
  @ApiResponse({ status: 500, description: 'Error interno.' })
  async cargueMasivo(@Body() cargaDatos: any): Promise<any> {
    try {
      const { base64data, complement: complemento } = cargaDatos;
      const estructura = await this.cargueMasivoService.crearEstructura(
        base64data,
        complemento,
      );
      const response = await axios.post(this.cargueMasivoUrl, estructura);
      return response.data;
    } catch (error) {
      console.error('Error en el MID:', error);
      if (axios.isAxiosError(error) && error.response) {
        throw new HttpException(
          `Error en el serverless: ${error.response.data.message || error.response.statusText}`,
          error.response.status,
        );
      }
      throw new HttpException(
        'Error procesando la solicitud',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
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
    try {
      const { base64data, complemento } = cargaDatos;
      const estructura =
        await this.cargueMasivoService.crearEstructuraActividad(
          base64data,
          complemento,
        );
      const response = await axios.post(this.cargueMasivoUrl, estructura);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        throw new HttpException(
          `Error en el serverless: ${error.response.data.message || error.response.statusText}`,
          error.response.status,
        );
      }
      throw new HttpException(
        'Error procesando la solicitud',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
