import { Injectable } from "@nestjs/common";
import { environment } from "../../config/configuration";
import axios from "axios";

@Injectable()
export class GestorDocumentalService {
  private readonly baseUrl = environment.GESTOR_DOCUMENTAL_SERVICE;

  async get(endpoint: string): Promise<any> {
    try {
      const response = await axios.get(`${this.baseUrl}/${endpoint}`);
      return response.data;
    } catch (error) {
      const newError = new Error(`GestorDocumentalService : get : Error con endpoint ${endpoint}: ${error.message}`);
      newError.stack += `\nCaused by:\n${error.stack}`;
      throw newError;
    }
  }

  async postAny(endpoint: string, element: any): Promise<any> {
    try {
      const response = await axios.post(`${this.baseUrl}/${endpoint}`, element);
      return response.data;
    } catch (error) {
      const newError = new Error(`GestorDocumentalService : postAny : Error con endpoint ${endpoint}: ${error.message}`);
      newError.stack += `\nCaused by:\n${error.stack}`;
      throw newError;
    }
  }
}
