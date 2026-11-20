import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { environment } from 'src/config/configuration';
import { ParametrosService } from 'src/shared/services/parametros.service';
import { DominiosService } from 'src/shared/utils/dominios/dominios.service';
import {
  ErrorValidacionHallazgo,
  validarHallazgosExternos,
} from 'src/shared/utils/validar-hallazgo-externo.util';
import { RegistrarAuditoriaExternaDto } from './dto/registrar-auditoria-externa.dto';
import { AuditoriaExternaRepositorio } from './auditoria-externa.repositorio';

const {
  AUDITORIA_EXTERNA,
  TIPO_PARAMETRO,
  TIPO_EVALUACION,
  ESTADO_AUDITORIA_EXTERNA,
  PLAN_MEJORAMIENTO_ESTADO,
  DOCUMENTO,
} = environment;

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;
const MAX_CODIGO = 50;
const MAX_NOMBRE_ENTIDAD = 200;
const MAX_NOMBRE_AUDITORIA = 300;
const MAX_ENLACE = 500;

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : '';
}

function enteroPositivo(valor: unknown): number | null {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Minúsculas, sin tildes y sin espacios repetidos: para comparar nombres. */
function normalizar(valor: unknown): string {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Registro de auditorías externas (#953). Todo se valida y se guarda en una sola operación
 * al pulsar Continuar en el MF: auditoría, estado, hallazgos, informe en PDF y el esqueleto del
 * plan de mejoramiento (estado 7081, auditor líder asignado). Fase 4 no se toca.
 */
@Injectable()
export class AuditoriaExternaService {
  private readonly logger = new Logger(AuditoriaExternaService.name);

  constructor(
    private readonly repositorio: AuditoriaExternaRepositorio,
    private readonly dominiosService: DominiosService,
    private readonly parametrosService: ParametrosService,
  ) {}

  async registrar(body: RegistrarAuditoriaExternaDto) {
    const errores: ErrorValidacionHallazgo[] = [];
    const datos = this.validarDatosGenerales(body, errores);

    if (!AUDITORIA_EXTERNA.ROLES_REGISTRO.includes(texto(body?.usuario_rol))) {
      throw new ForbiddenException(
        'El rol del usuario no puede registrar auditorías externas',
      );
    }

    const [vigencias, dependencias] = await Promise.all([
      firstValueFrom(
        this.dominiosService.getParametros(TIPO_PARAMETRO.VIGENCIA),
      ),
      firstValueFrom(this.dominiosService.getDependencias()),
    ]);
    const idsVigencia = vigencias.parametros.map((p) => p.Id);
    if (
      datos.vigencia_id !== null &&
      !idsVigencia.includes(datos.vigencia_id)
    ) {
      errores.push({
        fila: 0,
        campo: 'vigencia_id',
        motivo: 'La vigencia de la auditoría no existe.',
      });
    }

    const { hallazgos, errores: erroresHallazgos } = validarHallazgosExternos(
      Array.isArray(body?.hallazgos) ? body.hallazgos : [],
      {
        vigencias: idsVigencia,
        dependencias: dependencias.parametros.map((p) => p.Id),
      },
    );
    errores.push(...erroresHallazgos);

    if (errores.length) {
      throw new BadRequestException({
        message:
          'El registro contiene errores. No se guardó nada; corríjalos y vuelva a continuar.',
        errores,
      });
    }

    await this.verificarDuplicada(datos);
    const fuente = await this.resolverFuente();

    const resultado = await this.repositorio.crearRegistro({
      auditoria: {
        vigencia_id: datos.vigencia_id as number,
        codigo_entidad: datos.codigo_entidad,
        nombre_entidad: datos.nombre_entidad,
        nombre_auditoria: datos.nombre_auditoria,
        fecha_informe_final: datos.fecha_informe_final,
        dependencia_id: [
          ...new Set(hallazgos.flatMap((h) => h.dependencia_id)),
        ],
        estado_id: ESTADO_AUDITORIA_EXTERNA.REGISTRADA,
      },
      hallazgos,
      documento: {
        nuxeo_id: datos.nuxeo_id as number,
        nuxeo_enlace: datos.nuxeo_enlace,
        tipo_id: DOCUMENTO.TIPO_INFORME_FINAL,
        referencia_tipo: AUDITORIA_EXTERNA.REFERENCIA_TIPO_DOCUMENTO,
      },
      plan: {
        tipo_evaluacion_id: TIPO_EVALUACION.AUDITORIA_EXTERNA,
        estado_id: PLAN_MEJORAMIENTO_ESTADO.SIN_PLAN_MEJORAMIENTO,
        fuente,
        fase_id: AUDITORIA_EXTERNA.FASE_PLAN_MEJORAMIENTO,
      },
      usuario: {
        id: datos.usuario_id as number,
        rol: texto(body.usuario_rol),
      },
    });

    return {
      Success: true,
      Status: HttpStatus.CREATED,
      Message: 'Registro Exitoso',
      Data: resultado,
    };
  }

  async listar(query: Record<string, any>) {
    const limit = this.entero(
      query?.limit,
      AUDITORIA_EXTERNA.LIMITE_POR_DEFECTO,
      'limit',
    );
    const offset = this.entero(query?.offset, 0, 'offset');
    if (limit < 1 || limit > AUDITORIA_EXTERNA.LIMITE_MAXIMO) {
      throw new BadRequestException(
        `limit debe estar entre 1 y ${AUDITORIA_EXTERNA.LIMITE_MAXIMO}`,
      );
    }
    let filtro = 'activo:true';
    if (query?.vigencia_id !== undefined && query?.vigencia_id !== '') {
      const vigenciaId = enteroPositivo(query.vigencia_id);
      if (vigenciaId === null) {
        throw new BadRequestException(
          'vigencia_id debe ser un entero positivo',
        );
      }
      filtro = `vigencia_id:${vigenciaId},${filtro}`;
    }

    const [respuesta, vigencias] = await Promise.all([
      this.repositorio.listar({
        query: filtro,
        sortby: 'fecha_creacion',
        order: 'desc',
        limit,
        offset,
      }),
      firstValueFrom(
        this.dominiosService.getParametros(TIPO_PARAMETRO.VIGENCIA),
      ),
    ]);
    const nombreVigencia = new Map(
      vigencias.parametros.map((p) => [p.Id, p.Nombre]),
    );
    const data = (respuesta?.Data ?? []).map((a: any) => ({
      ...a,
      vigencia_nombre:
        nombreVigencia.get(a.vigencia_id) ?? String(a.vigencia_id),
    }));
    return {
      Success: true,
      Status: HttpStatus.OK,
      Message: 'Peticion Exitosa',
      Data: data,
      MetaData: { Count: respuesta?.MetaData?.Count ?? data.length },
    };
  }

  async obtener(id: string) {
    if (!OBJECT_ID.test(id ?? '')) {
      throw new BadRequestException(
        'El id de la auditoría externa no es válido',
      );
    }
    const registro = await this.repositorio.obtener(id);
    if (!registro) {
      throw new NotFoundException(
        `No se encontró la auditoría externa con id ${id}`,
      );
    }

    const [vigencias, dependencias] = await Promise.all([
      firstValueFrom(
        this.dominiosService.getParametros(TIPO_PARAMETRO.VIGENCIA),
      ),
      firstValueFrom(this.dominiosService.getDependencias()),
    ]);
    const nombreVigencia = new Map(
      vigencias.parametros.map((p) => [p.Id, p.Nombre]),
    );
    const nombreDependencia = new Map(
      dependencias.parametros.map((p) => [p.Id, p.Nombre]),
    );
    const nombres = (ids: number[] = []) =>
      ids.map((d) => nombreDependencia.get(d) ?? String(d));

    const informe = registro.documentos.find(
      (d: any) => d.tipo_id === DOCUMENTO.TIPO_INFORME_FINAL,
    );
    return {
      Success: true,
      Status: HttpStatus.OK,
      Message: 'Peticion Exitosa',
      Data: {
        ...registro.auditoria,
        vigencia_nombre:
          nombreVigencia.get(registro.auditoria.vigencia_id) ??
          String(registro.auditoria.vigencia_id),
        dependencias_nombre: nombres(registro.auditoria.dependencia_id),
        hallazgos: registro.hallazgos.map((h: any) => ({
          ...h,
          vigencia_nombre:
            nombreVigencia.get(h.vigencia_id) ?? String(h.vigencia_id),
          dependencias_nombre: nombres(h.dependencia_id),
        })),
        informe_final: informe
          ? { nuxeo_id: informe.nuxeo_id, nuxeo_enlace: informe.nuxeo_enlace }
          : null,
        plan_mejoramiento: registro.plan
          ? { _id: registro.plan._id, estado_id: registro.plan.estado_id }
          : null,
      },
    };
  }

  /** Valida los datos generales, el informe y el usuario; acumula todos los errores. */
  private validarDatosGenerales(
    body: RegistrarAuditoriaExternaDto,
    errores: ErrorValidacionHallazgo[],
  ) {
    const agregar = (campo: string, motivo: string) =>
      errores.push({ fila: 0, campo, motivo });

    const codigo = texto(body?.codigo_entidad);
    if (!codigo)
      agregar('codigo_entidad', 'El código de la entidad es obligatorio.');
    else if (codigo.length > MAX_CODIGO)
      agregar(
        'codigo_entidad',
        `El código de la entidad no puede superar ${MAX_CODIGO} caracteres.`,
      );
    else if (/[,:|]/.test(codigo))
      agregar(
        'codigo_entidad',
        'El código de la entidad no puede contener , : ni |.',
      );

    const nombreEntidad = texto(body?.nombre_entidad);
    if (!nombreEntidad)
      agregar('nombre_entidad', 'El nombre de la entidad es obligatorio.');
    else if (nombreEntidad.length > MAX_NOMBRE_ENTIDAD)
      agregar(
        'nombre_entidad',
        `El nombre de la entidad no puede superar ${MAX_NOMBRE_ENTIDAD} caracteres.`,
      );

    const nombreAuditoria = texto(body?.nombre_auditoria);
    if (!nombreAuditoria)
      agregar('nombre_auditoria', 'El nombre de la auditoría es obligatorio.');
    else if (nombreAuditoria.length > MAX_NOMBRE_AUDITORIA)
      agregar(
        'nombre_auditoria',
        `El nombre de la auditoría no puede superar ${MAX_NOMBRE_AUDITORIA} caracteres.`,
      );

    const fecha = new Date(texto(body?.fecha_informe_final));
    if (Number.isNaN(fecha.getTime()))
      agregar(
        'fecha_informe_final',
        'La fecha del informe final no es válida.',
      );

    const vigenciaId = enteroPositivo(body?.vigencia_id);
    if (vigenciaId === null)
      agregar('vigencia_id', 'La vigencia es obligatoria.');

    const usuarioId = enteroPositivo(body?.usuario_id);
    if (usuarioId === null) agregar('usuario_id', 'El usuario es obligatorio.');

    const nuxeoId = enteroPositivo(body?.documento?.nuxeo_id);
    const enlace = texto(body?.documento?.nuxeo_enlace);
    if (nuxeoId === null || !enlace)
      agregar('documento', 'Debe adjuntar el informe final en PDF.');
    else if (enlace.length > MAX_ENLACE)
      agregar('documento', 'El enlace del informe final es demasiado largo.');

    return {
      codigo_entidad: codigo,
      nombre_entidad: nombreEntidad,
      nombre_auditoria: nombreAuditoria,
      fecha_informe_final: Number.isNaN(fecha.getTime())
        ? ''
        : fecha.toISOString(),
      vigencia_id: vigenciaId,
      usuario_id: usuarioId,
      nuxeo_id: nuxeoId,
      nuxeo_enlace: enlace,
    };
  }

  /** 409 si ya existe una auditoría del mismo ente con el mismo nombre y fecha de informe. */
  private async verificarDuplicada(datos: {
    codigo_entidad: string;
    nombre_auditoria: string;
    fecha_informe_final: string;
  }) {
    const existentes = await this.repositorio.buscarPorEntidad(
      datos.codigo_entidad,
    );
    const dia = datos.fecha_informe_final.slice(0, 10);
    const repetida = existentes.some(
      (a: any) =>
        normalizar(a.nombre_auditoria) === normalizar(datos.nombre_auditoria) &&
        String(a.fecha_informe_final ?? '').slice(0, 10) === dia,
    );
    if (repetida) {
      throw new ConflictException(
        'Ya existe una auditoría externa de esta entidad con el mismo nombre y fecha de informe final',
      );
    }
  }

  /** Id del parámetro de fuente "Auditoría Externa" (se resuelve por código, no por id fijo). */
  private async resolverFuente(): Promise<number> {
    const { TIPO_PARAMETRO: tipo, CODIGO_ABREVIACION } =
      AUDITORIA_EXTERNA.FUENTE_PLAN;
    try {
      const respuesta = await this.parametrosService.get('parametro', null, {
        query: `TipoParametroId:${tipo},CodigoAbreviacion:${CODIGO_ABREVIACION},Activo:true`,
        fields: 'Id',
        limit: 1,
      });
      const id = respuesta?.Data?.[0]?.Id;
      if (id) return Number(id);
    } catch (error) {
      this.logger.error(
        `No se pudo consultar la fuente del plan: ${error?.message}`,
      );
    }
    throw new HttpException(
      `No existe el parámetro de fuente ${CODIGO_ABREVIACION} del plan de mejoramiento`,
      HttpStatus.BAD_GATEWAY,
    );
  }

  private entero(valor: unknown, defecto: number, nombre: string): number {
    if (valor === undefined || valor === null || valor === '') return defecto;
    const n = Number(valor);
    if (!Number.isInteger(n) || n < 0) {
      throw new BadRequestException(
        `${nombre} debe ser un entero mayor o igual a 0`,
      );
    }
    return n;
  }
}
