import {
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { AuditoriaCrudService } from 'src/shared/services/auditoria-crud.service';

@Injectable()
export class ActividadService {
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

    if (data?.Data == null) {
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
        // Lógica de remplazos.
      });
    } else if (typeof data.Data === 'object' && data.Data !== null) {
        // Lógica de remplazos para un solo objeto.
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
