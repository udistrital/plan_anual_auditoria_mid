import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class PlantillasMidService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async post(endpoint: string, data: any) {
    #const baseUrl = this.configService.get<string>('PLANTILLAS_MID_SERVICE');
    #const url = new URL(endpoint, baseUrl).toString();
    const url = `${this.configService.get<string>('PLANTILLAS_MID_SERVICE')}/${endpoint}`;
    console.log("PlantillasMidService - url: ", url)
    const response = await lastValueFrom(this.httpService.post(url, data));
    return response.data;
  }
}
