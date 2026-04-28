import { HttpService } from '@nestjs/axios';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class PlantillasMidService {

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService
  ) {}

  async post(endpoint: string, data: any) {
    const url = `${this.configService.get<string>('PLANTILLAS_MID_SERVICE')}/${endpoint}`;
    try {
      const response = await lastValueFrom(this.httpService.post(url, data));
      return response.data;
    } catch (error: any) {
      //log
      throw new HttpException(
        'Error al obtener los datos del servicio externo',
        HttpStatus.INTERNAL_SERVER_ERROR,
        error
      );
    }
  }
}
