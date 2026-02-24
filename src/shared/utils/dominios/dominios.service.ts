import { Injectable } from "@nestjs/common";
import { Observable, map, catchError } from "rxjs";
import { ParametrosService } from "src/shared/services/parametros/parametros.service";
import { OikosService } from "src/shared/services/oikos/oikos.service";
import { environment } from "src/config/configuration";
import { Parametro, Dominio } from "./dominio.model";
import { DOMINIOS_CONFIG } from "./dominios.config";

@Injectable()
export class DominiosService {
  constructor(
    private readonly oikosService: OikosService,
    private readonly parametrosService: ParametrosService
  ) {}

  /**
   * Retrieves the name of a parameter type based on its ID by searching through the PARAMETROS_TIPO_PARAMETRO configuration in the environment.
   * @param tipoParametroId The ID of the parameter type for which to retrieve the name.
   * @returns The name of the parameter type corresponding to the provided ID.
   * @throws An error if the provided ID is not found in the environment configuration.
   */
  getNombreTipoParametro(tipoParametroId: number): string {
    const tipos = environment.TIPO_PARAMETRO;
    for (const tipo of Object.keys(tipos)) {
      if (tipos[tipo] == tipoParametroId)
        return tipo;
    };
    throw new Error(`TipoParametroId ${tipoParametroId} not found in environment configuration`);
  }

  /**
   * Obtains the list of parameters for a given parameter type by fetching data from the PARAMETROS_SERVICE.
   * @param tipoParametroId The ID of the parameter type to fetch.
   * @returns An Observable that emits a Dominio object containing the API source, parameter type name, and an array of parameters.
   * @throws An error if the fetch operation fails or if the response is not in the expected format (See {@link Parametro}).
   */
  getParametros(tipoParametroId: number): Observable<Dominio> {
    const endpoint = `parametro?query=Activo:true,TipoParametroId:${tipoParametroId}&fields=Id,Nombre&limit=0`;
    try {
      return this.parametrosService.get(endpoint).pipe(
        map((response: any) => {
          if (!response)
            throw new Error('No response received from Parametros service');

          if (!response.Data)
            throw new Error('Invalid response format: missing Data property');

          return response.Data;
        }),
        map((data: Parametro[]) => ({
          api: DOMINIOS_CONFIG.NOMBRES_API.PARAMETROS,
          nombre: this.getNombreTipoParametro(tipoParametroId),
          tipoParametroId: tipoParametroId,
          parametros: data
        })),
        catchError(error => { throw this.createError("getParametros", error) })
      );
    }
    catch (error) {
      throw this.createError("getParametros", error);
    }
  }

  /**
   * Obtains the list of dependencies by fetching data from the OIKOS_SERVICE.
   * @returns An Observable that emits a Dominio object containing the API source, dependency name, and an array of dependencies.
   * @throws An error if the fetch operation fails or if the response is not in the expected format (See {@link Parametro}).
   */
  getDependencias(): Observable<Dominio> {
    const url = `dependencia?query=Activo:true&fields=Id,Nombre&limit=0`;
    try {
      return this.oikosService.get(url).pipe(
        map((response: any) => {
          if (!response)
            throw new Error('No response received from OIKOS service');

          return response;
        }),
        map((data: Parametro[]) => ({
          api: DOMINIOS_CONFIG.NOMBRES_API.OIKOS,
          nombre: DOMINIOS_CONFIG.NOMBRES_OIKOS.DEPENDENCIAS,
          parametros: data
        })),
        catchError(error => { throw this.createError("getDependencias", error) })
      );
    }
    catch (error) {
      throw this.createError("getDependencias", error);
    }
  }

  /**
   * Creates a custom error with additional context about the method that caused it.
   * @param method The name of the method where the error occurred.
   * @param error The original error object.
   * @returns A new Error object with enhanced context.
   */
  createError(method: string, error: any): Error {
    const errorMessage = `DominiosService : ${method} : Error: ${error.message}`;
    const newError = new Error(errorMessage);
    newError.stack += "\nCaused by: " + error.stack;
    return newError;
  }

};
