import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { AuditoriaCrudService } from 'src/shared/services/auditoria-crud.service';
import { DominiosService } from 'src/shared/utils/dominios/dominios.service';
import { environment } from 'src/config/configuration';

const { TIPO_PARAMETRO } = environment;

@Injectable()
export class PlanMejoramientoService {
  private estados: { Id: number; Nombre: string }[] = [];

  constructor(
    private readonly auditoriaCrudService: AuditoriaCrudService,
    private readonly dominiosService: DominiosService,
  ) {}

  async getAll(queryParams: any) {
    await this.cargarEstados();
    const data = await this.auditoriaCrudService.traerDataCrud('plan-mejoramiento', null, queryParams);
    this.reemplazarCampos(data);
    return data;
  }

  private async cargarEstados(): Promise<void> {
    if (this.estados.length) return;
    const dominio = await firstValueFrom(
      this.dominiosService.getParametros(TIPO_PARAMETRO.AUDITORIA_ESTADO),
    );
    this.estados = dominio.parametros as { Id: number; Nombre: string }[];
  }

  private reemplazarCampos(data: any): void {
    const procesar = (elemento: any) => {
      if (elemento?.estado_id !== undefined) {
        this.reemplazar(this.estados, elemento, 'estado_id');
      }
    };
    if (Array.isArray(data?.Data)) {
      data.Data.forEach(procesar);
    } else if (typeof data?.Data === 'object' && data.Data !== null) {
      procesar(data.Data);
    }
  }

  private reemplazar(array: { Id: number; Nombre: string }[], elemento: any, campo: string): void {
    const value = elemento[campo];
    const nuevoCampo = campo.replace('_id', '_nombre');
    const encontrado = array.find((p) => p.Id === value);
    elemento[nuevoCampo] = encontrado ? encontrado.Nombre : null;
  }
}
