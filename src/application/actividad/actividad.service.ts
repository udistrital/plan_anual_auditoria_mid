import { Injectable } from '@nestjs/common';
import { AuditoriaCrudService } from 'src/shared/services/auditoria-crud.service';

@Injectable()
export class ActividadService {
  private medio: { Id: number; Nombre: string }[] = [
    { Id: 1, Nombre: 'Digital' },
    { Id: 2, Nombre: 'Fisico' },
    { Id: 3, Nombre: 'Otro' },
  ];

  constructor(private readonly auditoriaCrudService: AuditoriaCrudService) {}

  async getAll(queryParams: any) {
    const data = await this.auditoriaCrudService.traerDataCrud('actividad', null, queryParams);
    if (await this.identificarCampo(data)) {
      this.reemplazarCampos(data);
    }
    return data;
  }

  async getOne(id: string) {
    const data = await this.auditoriaCrudService.traerDataCrud('actividad', id, null);
    if (await this.identificarCampo(data)) {
      this.reemplazarCampos(data);
    }
    return data;
  }

  private async identificarCampo(data: any) {
    let validacion = false;
    try {
      const firstElement = Array.isArray(data.Data) ? data.Data[0] : data.Data;
      if (firstElement && 'medio_id' in firstElement) {
        validacion = true;
      }
      return validacion;
    } catch (error) {
      console.error(error);
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

    //se realiza reemplazo de sufijo _id si existe, por _nombre
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
      if (encontrado) {
        element[nuevoCampo] = encontrado.Nombre;
      } else {
        console.warn(`No se encontró ${campo} para ID: ${value}`);
        element[nuevoCampo] = null;
      }
    }
    return element;
  }
}
