import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PlantillaUtilsService } from '../../../utils/plantilla.utils';
import { environment } from 'src/config/configuration';
import { AuditoriaService } from 'src/application/auditoria/auditoria.service';
import { lastValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';

interface CartaRenderizada {
  dependencia_id: number | null;
  dependencia_nombre: string;
  base64: string;
}

const {
  TERCEROS_SERVICE,
  CARGO,
  logoUDistrital,
  logoSIGUD
} = environment;

@Injectable()
export class PlantillaCartaPresentacionService {
  constructor(
    private readonly httpService: HttpService,
    private readonly plantillaUtils: PlantillaUtilsService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  async get(idAuditoria: string) {
    const auditoriaResponse = await this.auditoriaService.getOne(idAuditoria);
    const auditoria = auditoriaResponse?.Data || {};
    const dependencias: number[] = Array.isArray(auditoria.dependencia_id) ? auditoria.dependencia_id : [];
    const nombresDependencias = this.normalizarNombresDependencias(auditoria.dependencia_nombre, dependencias);
    const dependenciasRenderizar = dependencias.length > 0 ? dependencias : [null];

    const cartas = await Promise.all(
      dependenciasRenderizar.map(async (dependenciaId, index) => {
        const dependenciaNombre = String(nombresDependencias[index] || `Dependencia ${index + 1}`);
        const jefeDependencia = dependenciaId ? await this.obtenerJefeDependencia(dependenciaId) : 'No se encontró al jefe de la dependencia';
        const infoParaPlantilla = await this.organizarData(auditoria, dependenciaNombre, jefeDependencia);
        const baseRenderizado = await this.plantillaUtils.renderizarPlantilla(infoParaPlantilla);

        return {
          dependencia_id: dependenciaId,
          dependencia_nombre: dependenciaNombre,
          base64: baseRenderizado?.Data || baseRenderizado,
        } as CartaRenderizada;
      }),
    );

    return {
      Success: true,
      Status: 200,
      Message: 'Plantillas generadas exitosamente.',
      Data: cartas,
    };
  }

  private async organizarData(auditoria: any, dependenciaNombre: string, jefeDependencia: string) {
    const fechaInicio = auditoria?.fecha_inicio
      ? new Date(auditoria.fecha_inicio)
      : new Date();
    const mes = new Intl.DateTimeFormat('es-CO', { month: 'long' }).format(
      fechaInicio,
    );

    const infoParaPlantilla = {
      plantilla_id: environment.PLANTILLAS.CARTA_PRESENTACION,
      data: {
        logoUDistrital: logoUDistrital,
        logoSIGUD: logoSIGUD,
        ciudad: 'Bogotá D.C.',
        auditoria: auditoria.titulo,
        dia: fechaInicio.getDate(),
        mes,
        anio: fechaInicio.getFullYear(),
        objetivo: auditoria.objetivo,
        dependencia: dependenciaNombre,
        jefe_dependencia: jefeDependencia
      },
    };
    return infoParaPlantilla;
  }

  private normalizarNombresDependencias(
    dependenciasNombre: string[] | string,
    dependencias: number[],
  ): string[] {
    if (Array.isArray(dependenciasNombre)) {
      return dependenciasNombre;
    }

    if (typeof dependenciasNombre === 'string' && dependenciasNombre.length > 0) {
      return [dependenciasNombre];
    }

    return dependencias.map((_, index) => `Dependencia ${index + 1}`);
  }

  private async obtenerJefeDependencia(dependenciaId: number) {
    const url = `${TERCEROS_SERVICE}vinculacion?query=DependenciaId:${dependenciaId},CargoId:${CARGO.JEFE_DEPENDENCIA_ID},Activo:true`;
    try {
      const response = await lastValueFrom(this.httpService.get(url)); 
      return response.data[0].TerceroPrincipalId.NombreCompleto;
    } catch (error) {
      throw new HttpException(
          'Error al obtener los datos de terceros',
          HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
