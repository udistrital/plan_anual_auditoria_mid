import {
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { AuditoriaCrudService } from 'src/shared/services/auditoria-crud.service';

@Injectable()
export class ActividadService {
  private medio = [
    { Id: 1, Nombre: 'Digital' },
    { Id: 2, Nombre: 'Fisico' },
    { Id: 3, Nombre: 'Otro' },
  ];

  constructor(
    private readonly auditoriaCrudService: AuditoriaCrudService,
  ) {}

  async getAll(queryParams: any) {
    const data = await this.auditoriaCrudService.traerDataCrud(
      'actividad',
      null,
      queryParams,
    );

    if (this.identificarCampo(data)) {
      this.reemplazarCampos(data);
    }

    return data;
  }

  async getOne(id: string) {
    const data = await this.auditoriaCrudService.traerDataCrud(
      'actividad',
      id,
      null,
    );

    if (!data || !data.Data) {
      throw new NotFoundException(`No se encontró actividad con id ${id}`);
    }
  
    if (this.identificarCampo(data)) {
      this.reemplazarCampos(data);
    }
  
    return data;
  }

  private identificarCampo(data: any): boolean {
    const firstElement = Array.isArray(data.Data)
      ? data.Data[0]
      : data.Data;

    return !!(firstElement && 'medio_id' in firstElement);
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