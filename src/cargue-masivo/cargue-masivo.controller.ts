import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { CargueMasivoService } from './cargue-masivo.service';
import axios from 'axios';
import { environment } from 'src/config/configuration';

@ApiTags('Cargue Masivo')
@Controller('cargue-masivo')
export class CargueMasivoController {
  constructor(private readonly cargueMasivoService: CargueMasivoService) {}
  private serverlessUrl = environment.CARGUE_MASIVO_SERVERLESS_MID;

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
        tipoCarga: { type: 'string', description: 'Tipo de carga.' },
      },
      required: ['base64data', 'complemento', 'tipoCarga'],
    },
  })
  @ApiResponse({ status: 201, description: 'Carga masiva exitosa.' })
  @ApiResponse({ status: 400, description: 'Datos inválidos.' })
  @ApiResponse({ status: 500, description: 'Error interno.' })
  async cargueMasivo(@Body() cargaDatos: any): Promise<any> {
    try {
      const { base64data, complemento, tipoCarga } = cargaDatos;
      const estructura = await this.cargueMasivoService.crearEstructura(
        base64data,
        complemento,
        tipoCarga,
      );
      const response = await axios.post(this.serverlessUrl, estructura);
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
        tipoCarga: { type: 'string', description: 'Tipo de carga.' },
      },
      required: ['base64data', 'complemento', 'tipoCarga'],
    },
  })
  @ApiResponse({ status: 201, description: 'Carga masiva exitosa.' })
  @ApiResponse({ status: 400, description: 'Datos inválidos.' })
  @ApiResponse({ status: 500, description: 'Error interno.' })
  async cargueMasivoActividades(@Body() cargaDatos: any): Promise<any> {
    try {
      const { base64data, complemento, tipoCarga } = cargaDatos;
      const estructura =
        await this.cargueMasivoService.crearEstructuraActividad(
          base64data,
          complemento,
          tipoCarga,
        );
      const response = await axios.post(this.serverlessUrl, estructura);
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
