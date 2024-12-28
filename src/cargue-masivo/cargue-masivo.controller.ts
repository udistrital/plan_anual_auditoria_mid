import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { CargueMasivoService } from './cargue-masivo.service';
import axios from 'axios';
import { environment } from 'src/config/configuration';

@Controller('cargue-masivo')
export class CargueMasivoController {
  constructor(private readonly cargueMasivoService: CargueMasivoService) {}
  private serverlessUrl = environment.CARGUE_MASIVO_SERVERLESS_MID;
  @Post('auditorias')
  async cargueMasivo(@Body() cargaDatos: any): Promise<any> {
    try {
      const { base64data, complemento, tipoCarga } = cargaDatos;

      const estructura = await this.cargueMasivoService.crearEstructura(
        base64data,
        complemento,
        tipoCarga,
      );

     // const serverlessUrl = environment.CARGUE_MASIVO_SERVERLESS_MID;
      const response = await axios.post(this.serverlessUrl, estructura);

      return response.data;
    } catch (error) {
      console.error('Error procesando la solicitud:', error);

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
  async cargueMasivoActividades(@Body() cargaDatos: any): Promise<any> {
    try {
      const { base64data, complemento, tipoCarga } = cargaDatos;

      const estructura = await this.cargueMasivoService.crearEstructuraActividad(base64data,complemento,tipoCarga,);
      console.log("url: ", this.serverlessUrl)
      console.log("estructura: ", estructura)

      //const serverlessUrl = environment.CARGUE_MASIVO_SERVERLESS_MID;
      const response = await axios.post(this.serverlessUrl, estructura);

      return response.data;
    } catch (error) {
      console.error('Error procesando la solicitud:', error);

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

