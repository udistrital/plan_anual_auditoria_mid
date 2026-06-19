import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { lastValueFrom } from 'rxjs';
import { environment } from 'src/config/configuration';
import { reemplazarCampoRol } from 'src/utils/campo.utils';
import { AuditoriaCrudService } from 'src/shared/services/auditoria-crud.service';
import { TercerosHelperService } from 'src/shared/services/terceros-helper.service';
import { DominiosService } from 'src/shared/utils/dominios/dominios.service';

const { ETIQUETAS_ROL } = environment;

@Injectable()
export class HallazgoRemisionService {
  private readonly dependencias: any[] = [];

  constructor(
    private readonly auditoriaCrudService: AuditoriaCrudService,
    private readonly tercerosService: TercerosHelperService,
    private readonly dominiosService: DominiosService,
  ) {}

  async getAll(queryParams: any) {
    const data = await this.auditoriaCrudService.traerDataCrud(
      'hallazgo-remision',
      null,
      queryParams,
    );

    if (await this.identificarCampo(data)) {
      await this.reemplazarCampos(data);
    }

    return data;
  }

  async getOne(id: string) {
    if (!id) {
      throw new BadRequestException('El id es requerido');
    }

    const data = await this.auditoriaCrudService.traerDataCrud(
      'hallazgo-remision',
      id,
      null,
    );

    if (data?.Data == null) {
      throw new NotFoundException(`No se encontró remisión de hallazgo con id ${id}`);
    }

    if (await this.identificarCampo(data)) {
      await this.reemplazarCampos(data);
    }

    return data;
  }

  private async identificarCampo(data: any) {
    try {
      const firstElement = Array.isArray(data.Data) ? data.Data[0] : data.Data;
      if (!firstElement) {
        return false;
      }

      const necesitaDependencias =
        'dependencia_origen_id' in firstElement ||
        'dependencia_destino_id' in firstElement;
      const necesitaUsuario = 'usuario_id' in firstElement || 'usuario_rol' in firstElement;

      if (necesitaDependencias && this.dependencias.length === 0) {
        await this.cargarDependencias();
      }

      return necesitaDependencias || necesitaUsuario;
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  private async cargarDependencias() {
    try {
      const resultado = await lastValueFrom(this.dominiosService.getDependencias());
      if (resultado?.parametros) {
        this.dependencias.push(...resultado.parametros);
      }
    } catch (error) {
      console.warn('Error al cargar dependencias', error);
    }
  }

  private async reemplazarCampos(data: any) {
    if (Array.isArray(data.Data)) {
      await Promise.all(
        data.Data.map(async (element) => {
          await this.procesarElemento(element);
        }),
      );
    } else if (typeof data.Data === 'object' && data.Data !== null) {
      await this.procesarElemento(data.Data);
    }
    return data;
  }

  private async procesarElemento(element: any) {
    if (element.usuario_rol !== undefined) {
      reemplazarCampoRol(element, ETIQUETAS_ROL);
    }
    if (element.usuario_id !== undefined) {
      await this.reemplazarCampoUsuario(element);
    }
    if (element.dependencia_origen_id !== undefined) {
      this.reemplazarCampoDependenciaOrigen(element);
    }
    if (element.dependencia_destino_id !== undefined) {
      this.reemplazarCampoDependenciaDestino(element);
    }
  }

  private async reemplazarCampoUsuario(element: any) {
    try {
      const usuario = await this.tercerosService.getTerceroById(
        element.usuario_id,
      );
      element.usuario = {
        id: usuario.Id,
        nombre: usuario.NombreCompleto.replace(/(^|\s)\p{L}/gu, (letra) =>
          letra.toUpperCase(),
        ),
      };
      delete element.usuario_id;
    } catch (error) {
      console.warn(
        `Error al reemplazar usuario para ID: ${element.usuario_id}`,
        error,
      );
      element.usuario = { id: element.usuario_id, nombre: null };
      delete element.usuario_id;
    }
  }

  private reemplazarCampoDependenciaOrigen(element: any) {
    const dependencia = this.obtenerDependenciaPorId(element.dependencia_origen_id);
    element.dependencia_origen = {
      id: element.dependencia_origen_id,
      nombre: dependencia?.Nombre ?? null,
    };
    delete element.dependencia_origen_id;
  }

  private reemplazarCampoDependenciaDestino(element: any) {
    const idsArray = Array.isArray(element.dependencia_destino_id)
      ? element.dependencia_destino_id
      : [element.dependencia_destino_id];

    element.dependencias_destino = idsArray.map((id) => {
      const dependencia = this.obtenerDependenciaPorId(id);
      return { id, nombre: dependencia?.Nombre ?? null };
    });

    delete element.dependencia_destino_id;
  }

  private obtenerDependenciaPorId(id: any) {
    return this.dependencias.find((dependencia) => dependencia.Id === id);
  }
}
