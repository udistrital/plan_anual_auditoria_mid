import { Inject, Injectable } from '@nestjs/common';
import { environment } from 'src/config/configuration';
import { capitalize, unirListaNombres } from 'src/utils/texto.utils';
import { AuditoriaService } from 'src/application/auditoria/auditoria.service';
import { PlantillasMidService } from 'src/shared/services/plantillas-mid.service';
import { AuditoriaCrudService } from 'src/shared/services/auditoria-crud.service';
import { ParametrosService } from 'src/shared/services/parametros.service';
import { TercerosHelperService } from 'src/shared/services/terceros-helper.service';
import { OikosService } from 'src/shared/services/oikos.service';

const { PLANTILLAS, logoUDistritalOCI, contactoOCI, CARGO } = environment;

@Injectable()
export class PlantillaSolicitudInformacionService {
  constructor(
    private readonly plantillasMidService: PlantillasMidService,
    private readonly auditoriaCrudService: AuditoriaCrudService,
    private readonly parametrosService: ParametrosService,
    private readonly auditoriaService: AuditoriaService,
    private readonly tercerosService: TercerosHelperService,
    private readonly oikosService: OikosService,
    @Inject('MOMENT') private readonly moment: any,
  ) {}

  async get(idAuditoria: string) {
    const auditoria = await this.auditoriaService.getOne(idAuditoria);
    const infoParaPlantilla = await this.organizarData(auditoria.Data);
    const baseRenderizado = await this.plantillasMidService.post(
      '/v1/plantilla/renderizar',
      infoParaPlantilla,
    );
    return baseRenderizado;
  }

  private async organizarData(auditoria: any) {
    const auditoriaPadre = auditoria;

    const [dependencias, vigencia, auditoriaOSeguimiento, auditores, jefeOci] =
      await Promise.all([
        this.obtenergrupoDependencias(auditoriaPadre.dependencia_id),
        this.parametrosService
          .get('parametro', auditoriaPadre.vigencia_id, null)
          .then((data) => data.Data),
        this.parametrosService
          .get('parametro', auditoriaPadre.tipo_evaluacion_id, null)
          .then((data) => data.Data),
        this.obtenerNombresAuditores(auditoria._id),
        this.tercerosService.getJefeOCI(),
      ]);

    const infoParaPlantilla = {
      plantilla_id: PLANTILLAS.SOLICITUD_INFORMACION,
      data: {
        logoUDistrital: logoUDistritalOCI,
        fecha: this.moment().utcOffset('-05:00').format('D [de] MMMM [de] YYYY'),
        fecha_inicio: this.moment(auditoria.fecha_inicio).format('DD/MM/YYYY'),
        consecutivo_oci: auditoria.consecutivo_OCI,
        dependencias: dependencias,
        ciudad: 'Bogotá D.C.',
        referencia:
          auditoriaOSeguimiento.Nombre + ' - ' + auditoriaPadre.titulo,
        anoAuditoria: vigencia.Nombre,
        tipo_auditoria: auditoriaOSeguimiento.Nombre,
        auditores: auditores,
        tema: auditoria.tema,
        jefe_oci:
          jefeOci ||
          'No se encontró el jefe de la Oficina Asesora de Control Interno',
        contacto_oci: contactoOCI,
      },
    };

    return infoParaPlantilla;
  }

  private async obtenerNombresAuditores(auditoriaId: string): Promise<string> {
    const params = {
      query: `auditoria_id:${auditoriaId},activo:true`,
      fields: 'auditor_id',
      limit: '0',
    };
    const auditores = await this.auditoriaCrudService
      .traerDataCrud('auditor', null, params)
      .then((data) => data.Data);

    if (!auditores?.length) return 'No se encontraron auditores.';

    const nombres = await Promise.all(
      auditores.map(async (auditor) => {
        const tercero = await this.tercerosService.getTerceroById(
          auditor.auditor_id,
        );
        return tercero?.NombreCompleto
          ? capitalize(tercero.NombreCompleto)
          : null;
      }),
    );

    const todosValidos = nombres.every((nombre) => nombre !== null);

    if (!todosValidos) {
      throw new Error('Error al obtener los nombres de los auditores para plantilla Solicitud de Información');
    }

    return unirListaNombres(nombres);
  }

  private obtenerDependenciaPrincipal(
    dependenciaId: number | number[],
  ): number | null {
    if (Array.isArray(dependenciaId)) {
      return dependenciaId.length > 0 ? dependenciaId[0] : null;
    }

    return typeof dependenciaId === 'number' ? dependenciaId : null;
  }

  private async obtenergrupoDependencias(dependencias: any): Promise<any> {
    const respuestaDependencias = [];

    if (Array.isArray(dependencias)) {
      for (const idDependencia of dependencias) {
        const dependencia = await this.oikosService
          .traerData('dependencia', idDependencia, null);
        const responsableDependencia =
          await this.tercerosService.getTerceroVinculado(
            idDependencia,
            CARGO.JEFE_DEPENDENCIA_ID,
          );

        respuestaDependencias.push({
          nombre: dependencia.Nombre,
          responsable:
            responsableDependencia?.NombreCompleto ||
            'No se encontró el responsable de la dependencia',
        });
      }
    } else {
      const dependencia = await this.oikosService
        .traerData('dependencia', dependencias, null);
      const responsableDependencia =
        await this.tercerosService.getTerceroVinculado(
          dependencias,
          CARGO.JEFE_DEPENDENCIA_ID,
        );

      respuestaDependencias.push({
        nombre: dependencia.Nombre,
        responsable:
          responsableDependencia?.NombreCompleto ||
          'No se encontró el responsable de la dependencia',
      });
    }
    return respuestaDependencias;
  }
}
