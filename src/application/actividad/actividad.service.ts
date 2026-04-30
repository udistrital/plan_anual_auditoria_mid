import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { AuditoriaCrudService } from 'src/shared/services/auditoria-crud.service';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class ActividadService {
  private medio = [
    { Id: 1, Nombre: 'Digital' },
    { Id: 2, Nombre: 'Fisico' },
    { Id: 3, Nombre: 'Otro' },
  ];

  constructor(
    private readonly auditoriaCrudService: AuditoriaCrudService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(ActividadService.name);
  }

  async getAll(queryParams: any) {
    try {
      const data = await this.auditoriaCrudService.traerDataCrud(
        'actividad',
        null,
        queryParams,
      );

      if (!data || !data.Data || data.Data.length === 0) {
        throw new NotFoundException('No se encontraron actividades');
      }

      if (await this.identificarCampo(data)) {
        this.reemplazarCampos(data);
      }

      return data;
    } catch (error) {
      this.logger.error(
        { err: error, queryParams },
        'Error en ActividadService.getAll',
      );

      throw error instanceof NotFoundException
        ? error
        : new InternalServerErrorException('Error obteniendo actividades');
    }
  }

  async getOne(id: string) {
    try {
      const data = await this.auditoriaCrudService.traerDataCrud(
        'actividad',
        id,
        null,
      );

      if (!data || !data.Data) {
        throw new NotFoundException(`Actividad con id ${id} no encontrada`);
      }

      if (await this.identificarCampo(data)) {
        this.reemplazarCampos(data);
      }

      return data;
    } catch (error) {
      this.logger.error(
        { err: error, id },
        'Error en ActividadService.getOne',
      );

      throw error instanceof NotFoundException
        ? error
        : new InternalServerErrorException('Error obteniendo actividad');
    }
  }

  private async identificarCampo(data: any): Promise<boolean> {
    try {
      const firstElement = Array.isArray(data.Data)
        ? data.Data[0]
        : data.Data;

      return !!(firstElement && 'medio_id' in firstElement);
    } catch (error) {
      this.logger.error({ err: error }, 'Error en identificarCampo');
      return false;
    }
  }

  private reemplazarCampos(data: any) {
    if (Array.isArray(data.Data)) {
      data.Data.forEach((element) => {
        if (element.medio_id !== undefined) {
          this.reemplazar(this.medio, element, 'medio_id');
        }
      });
    } else if (typeof data.Data === 'object' && data.Data !== null) {
      if (data.Data.medio_id !== undefined) {
        this.reemplazar(this.medio, data.Data, 'medio_id');
      }
    }
    return data;
  }

  private reemplazar(array: any[], element: any, campo: string) {
    const value = element[campo];

    const nuevoCampo = campo.endsWith('_id')
      ? campo.replace('_id', '_nombre')
      : `${campo}_nombre`;

    if (Array.isArray(value)) {
      element[nuevoCampo] = value.map((id) => {
        const encontrado = array.find((param) => param.Id === id);
        return encontrado ? encontrado.Nombre : id;
      });
    } else {
      const encontrado = array.find((param) => param.Id === value);
      element[nuevoCampo] = encontrado ? encontrado.Nombre : null;
    }

    return element;
  }
}