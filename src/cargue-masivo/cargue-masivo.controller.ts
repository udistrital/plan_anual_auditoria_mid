import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { CargueMasivoService } from './cargue-masivo.service';
import axios from 'axios';


@Controller('cargue-masivo')
export class CargueMasivoController {

    constructor(private readonly cargueMasivoService: CargueMasivoService) {}

    @Post('auditorias')
    async cargueMasivo(@Body() payload: any): Promise<any> {
        try {
            
            const{ base64data, complement, type_upload } = payload;

            const estructura = await this.cargueMasivoService.crearEstructura(
                base64data,
                complement.plan_auditoria_id,
                type_upload);

            console.log('Estructura a enviar:', JSON.stringify(estructura, null, 2));
            
            const serverlessUrl = process.env.CARGUE_MASIVO_SERVERLESS_MID;
            console.log("lambdaUrl: ",serverlessUrl);
            const response = await axios.post(serverlessUrl, estructura);
            return response.data;

        } catch (error) {
            console.error('Error procesando la solicitud:', error);

            if (axios.isAxiosError(error) && error.response) {
                throw new HttpException(
                    `Error en el serverless: ${error.response.data.message || error.response.statusText}`,
                    error.response.status,
                );
            }

            throw new HttpException('Error procesando la solicitud', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
