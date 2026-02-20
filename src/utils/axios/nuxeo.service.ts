import { Injectable } from "@nestjs/common";
import { GestorDocumentalService } from "./gestor-documental.service";

@Injectable()
export class NuxeoService {
  constructor(private gestorDocumentalService: GestorDocumentalService) {}

  async obtenerPorUUID(uuid: string): Promise<string> {
    try {
      const response = await this.gestorDocumentalService.get(`document/${uuid}`);
      if (!response?.file)
        throw new Error('El campo "file" no se encontró en la respuesta.');
      
      return response.file;
    } catch (error) {
      console.error(`NuxeoService : obtenerPorUUID : Error al obtener el documento con UUID ${uuid} :`, error);
      return ""; // Retorna un string vacío en caso de error
    }
  }

}
