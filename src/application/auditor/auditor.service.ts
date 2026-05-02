import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
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
    if (!id) {
      throw new BadRequestException('El id es requerido');
    }

    const data = await this.auditoriaCrudService.traerDataCrud(
      'auditor',
      id,
      null,
    );

    if (!data || !data.Data) {
      throw new NotFoundException(`No se encontró auditor con id ${id}`);
    }

    await this.reemplazarCampos(data);

    return data;
  }

  private async reemplazarCampos(data: any) {
    const procesarElemento = async (elemento: any) => {
      const promises: Promise<void>[] = [];

      if (elemento?.auditor_id) {
        promises.push(
          this.tercerosHelper
            .getTerceroById(elemento.auditor_id)
            .then((tercero) => {
              elemento.auditor_nombre =
                tercero?.NombreCompleto || null;
            }),
        );
      }

      if (elemento?.asignado_por_id) {
        promises.push(
          this.tercerosHelper
            .getTerceroById(elemento.asignado_por_id)
            .then((tercero) => {
              elemento.asignado_por_nombre =
                tercero?.NombreCompleto || null;
            }),
        );
      }

      await Promise.all(promises);
    };

    if (Array.isArray(data?.Data)) {
      await Promise.all(data.Data.map(procesarElemento));
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
        const encontrado = arrayTercero.find(
          (param) => param.Id === doc,
        );
        return encontrado ? encontrado.NombreCompleto : doc;
      });
    } else {
      const encontrado = arrayTercero.find(
        (param) => param.Id === elementoData,
      );

      elemento[nuevoCampo] = encontrado
        ? encontrado.NombreCompleto
        : null;
    }

    return elemento;
  }
}