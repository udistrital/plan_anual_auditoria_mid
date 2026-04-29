import { Injectable } from '@nestjs/common';
import { AuditoriaCrudService } from 'src/shared/services/auditoria-crud.service';
import { TercerosHelperService } from 'src/shared/services/terceros-helper.service';

@Injectable()
export class AuditorService {
  constructor(
    private readonly auditoriaCrudService: AuditoriaCrudService,
    private readonly tercerosHelper: TercerosHelperService,
  ) {}

  async getAll(queryParams: any) {
    const data = await this.auditoriaCrudService.traerDataCrud(
      'auditor',
      null,
      queryParams,
    );
    await this.reemplazarCampos(data);
    return data;
  }

  async getOne(id: string) {
    const data = await this.auditoriaCrudService.traerDataCrud(
      'auditor',
      id,
      null,
    );
    await this.reemplazarCampos(data);
    return data;
  }

  private async reemplazarCampos(data: any) {
    const procesarElemento = async (elemento: any) => {
      if (elemento?.auditor_id) {
        const tercero = await this.tercerosHelper.getTerceroById(
          elemento.auditor_id,
        );
        elemento.auditor_nombre = tercero?.NombreCompleto || null;
      }

      if (elemento?.asignado_por_id) {
        const tercero = await this.tercerosHelper.getTerceroById(
          elemento.asignado_por_id,
        );
        elemento.asignado_por_nombre = tercero?.NombreCompleto || null;
      }
    };

    if (Array.isArray(data?.Data)) {
      for (const elemento of data.Data) {
        await procesarElemento(elemento);
      }
    } else if (typeof data?.Data === 'object' && data.Data !== null) {
      await procesarElemento(data.Data);
    }

    return data;
  }

  private reemplazar(arrayTercero: any[], elemento: any, campo: string) {
    const elementoData = elemento[campo];
    if (!Array.isArray(arrayTercero)) {
      arrayTercero = [arrayTercero];
    }
    const nuevoCampo = campo.endsWith('_id')
      ? campo.replace('_id', '_nombre')
      : `${campo}_nombre_completo`;
    if (Array.isArray(elementoData)) {
      elemento[nuevoCampo] = elementoData.map((doc) => {
        const encontrado = arrayTercero.find((param) => param.Id === doc);
        return encontrado ? encontrado.NombreCompleto : doc;
      });
    } else {
      const encontrado = arrayTercero.find(
        (param) => param.Id === elementoData,
      );
      if (encontrado) {
        elemento[nuevoCampo] = encontrado.NombreCompleto;
      } else {
        console.warn(`No se encontró ${campo} para ID: ${elementoData}`);
        elemento[nuevoCampo] = null;
      }
    }
    return elemento;
  }
}
