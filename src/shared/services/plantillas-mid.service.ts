import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class PlantillasMidService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) { }

  async post(endpoint: string, data: any) {
    const host = this.configService.get<string>('PLANTILLAS_MID_SERVICE');

    // 1. Quitamos la diagonal al final del host (si la tiene)
    const cleanHost = host.replace(/\/$/, '');

    // 2. Quitamos la diagonal al inicio del endpoint (si la tiene)
    const cleanEndpoint = endpoint.replace(/^\//, '');

    const url = `${cleanHost}/${cleanEndpoint}`;
    const response = await lastValueFrom(this.httpService.post(url, data));
    return response.data;
  }
}
