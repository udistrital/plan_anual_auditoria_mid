import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { lastValueFrom } from 'rxjs';
import { environment } from 'src/config/configuration';
import { AuditoriaCrudService } from 'src/shared/services/auditoria-crud.service';
import { TercerosHelperService } from 'src/shared/services/terceros-helper.service';
import { DominiosService } from 'src/shared/utils/dominios/dominios.service';
import {
  ComentarioAccionRespuesta,
  CrearComentarioAccionDto,
} from './dto/crear-comentario-accion.dto';

const { ETIQUETAS_ROL, CARGO, FORO_ACCION } = environment;

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;
const TAMANO_LOTE = 10;

/** Cargo de la vinculación en Terceros según el rol de dependencia. */
const CARGO_POR_ROL: Record<string, number> = {
  JEFE_DEPENDENCIA: CARGO.JEFE_DEPENDENCIA_ID,
  ASISTENTE_DEPENDENCIA: CARGO.ASISTENTE_DEPENDENCIA_ID,
};

export interface Participacion {
  puede: boolean;
  dependencia_id?: number;
}

/**
 * Foro de discusión de una acción de mejora (#948): lista plana de comentarios.
 * Escriben las dependencias responsables (líder o apoyo) y cualquier rol de Control Interno;
 * no depende del estado del plan ni de la acción.
 */
@Injectable()
export class ComentarioAccionService {
  private readonly logger = new Logger(ComentarioAccionService.name);

  constructor(
    private readonly auditoriaCrudService: AuditoriaCrudService,
    private readonly tercerosHelper: TercerosHelperService,
    private readonly dominiosService: DominiosService,
  ) {}

  async listar(accionId: string, query: any) {
    this.validarAccionId(accionId);
    const limit = this.entero(
      query?.limit,
      FORO_ACCION.LIMITE_POR_DEFECTO,
      'limit',
    );
    const offset = this.entero(query?.offset, 0, 'offset');
    if (limit < 1 || limit > FORO_ACCION.LIMITE_MAXIMO) {
      throw new BadRequestException(
        `limit debe estar entre 1 y ${FORO_ACCION.LIMITE_MAXIMO}`,
      );
    }
    const personaId = query?.persona_id ? Number(query.persona_id) : null;
    const rol = query?.rol ? String(query.rol) : null;

    await this.obtenerAccion(accionId);

    const [respuesta, participacion] = await Promise.all([
      this.auditoriaCrudService.traerDataCrud('comentario-accion', null, {
        query: `accion_mejora_id:${accionId},activo:true`,
        sortby: 'fecha_creacion',
        order: 'desc',
        limit,
        offset,
      }),
      Number.isInteger(personaId) && personaId > 0 && rol
        ? this.resolverParticipacion(accionId, personaId, rol)
        : Promise.resolve<Participacion>({ puede: false }),
    ]);

    const comentarios = Array.isArray(respuesta?.Data) ? respuesta.Data : [];
    const data = await this.enriquecer(comentarios);

    return {
      Success: true,
      Status: HttpStatus.OK,
      Message: 'Peticion Exitosa',
      Data: data,
      MetaData: {
        Count: respuesta?.MetaData?.Count ?? data.length,
        puede_comentar: participacion.puede,
      },
    };
  }

  async publicar(accionId: string, body: CrearComentarioAccionDto) {
    this.validarAccionId(accionId);
    const mensaje =
      typeof body?.mensaje === 'string' ? body.mensaje.trim() : '';
    if (!mensaje) {
      throw new BadRequestException('El mensaje es obligatorio');
    }
    if (mensaje.length > FORO_ACCION.LONGITUD_MAXIMA_MENSAJE) {
      throw new BadRequestException(
        `El mensaje no puede superar ${FORO_ACCION.LONGITUD_MAXIMA_MENSAJE} caracteres`,
      );
    }
    const usuarioId = Number(body?.usuario_id);
    if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
      throw new BadRequestException('usuario_id debe ser un entero positivo');
    }
    const rol = body?.usuario_rol;
    // Propiedad propia y no `in`: `in` acepta claves heredadas como "toString"
    if (
      typeof rol !== 'string' ||
      !Object.prototype.hasOwnProperty.call(ETIQUETAS_ROL, rol)
    ) {
      throw new BadRequestException('usuario_rol no es un rol válido');
    }

    await this.obtenerAccion(accionId);

    const participacion = await this.resolverParticipacion(
      accionId,
      usuarioId,
      rol,
    );
    if (!participacion.puede) {
      throw new ForbiddenException(
        'El usuario no participa en el foro de esta acción',
      );
    }

    let creado: any;
    try {
      const respuesta = await this.auditoriaCrudService.post(
        'comentario-accion',
        {
          accion_mejora_id: accionId,
          mensaje,
          usuario_id: usuarioId,
          usuario_rol: rol,
          ...(participacion.dependencia_id != null && {
            dependencia_id: participacion.dependencia_id,
          }),
        },
      );
      creado = respuesta?.Data;
    } catch (error) {
      this.logger.error(
        `No se pudo registrar el comentario de la acción ${accionId}: ${error?.message}`,
      );
      throw new HttpException(
        'No se pudo registrar el comentario en el servicio CRUD',
        HttpStatus.BAD_GATEWAY,
      );
    }
    if (!creado) {
      throw new HttpException(
        'El servicio CRUD no devolvió el comentario creado',
        HttpStatus.BAD_GATEWAY,
      );
    }

    const [comentario] = await this.enriquecer([creado]);
    return {
      Success: true,
      Status: HttpStatus.CREATED,
      Message: 'Registro Exitoso',
      Data: comentario,
    };
  }

  /** Quién puede escribir en el foro de la acción (decisión 2 de la especificación #948). */
  async resolverParticipacion(
    accionId: string,
    personaId: number,
    rol: string,
  ): Promise<Participacion> {
    if (FORO_ACCION.ROLES_CONTROL_INTERNO.includes(rol)) {
      return { puede: true };
    }
    const cargoId = FORO_ACCION.ROLES_DEPENDENCIA.includes(rol)
      ? CARGO_POR_ROL[rol]
      : undefined;
    if (!cargoId) {
      return { puede: false };
    }

    const [dependenciasPersona, responsables] = await Promise.all([
      this.tercerosHelper.getDependenciasByPersona(personaId, cargoId),
      this.auditoriaCrudService.traerDataCrud('responsable-accion', null, {
        query: `accion_mejora_id:${accionId},activo:true`,
        limit: 0,
      }),
    ]);

    const propias = new Set((dependenciasPersona ?? []).map(Number));
    const coinciden = (
      Array.isArray(responsables?.Data) ? responsables.Data : []
    ).filter((r: any) => propias.has(Number(r.dependencia_id)));
    if (coinciden.length === 0) {
      return { puede: false };
    }
    const elegida =
      coinciden.find((r: any) => r.dependencia_lider) ?? coinciden[0];
    return { puede: true, dependencia_id: Number(elegida.dependencia_id) };
  }

  private async obtenerAccion(accionId: string) {
    const respuesta = await this.auditoriaCrudService.traerDataCrud(
      'accion-mejora',
      null,
      {
        query: `_id:${accionId},activo:true`,
        limit: 1,
      },
    );
    const accion = Array.isArray(respuesta?.Data) ? respuesta.Data[0] : null;
    if (!accion) {
      throw new NotFoundException(
        `No se encontró la acción de mejora con id ${accionId}`,
      );
    }
    return accion;
  }

  /** Agrega nombre del autor, etiqueta del rol y nombre de la dependencia, sin N+1 por comentario. */
  private async enriquecer(
    comentarios: any[],
  ): Promise<ComentarioAccionRespuesta[]> {
    if (comentarios.length === 0) return [];

    const usuarioIds = [
      ...new Set(comentarios.map((c) => Number(c.usuario_id))),
    ];
    const nombres = new Map<number, string | null>();
    for (let i = 0; i < usuarioIds.length; i += TAMANO_LOTE) {
      const lote = usuarioIds.slice(i, i + TAMANO_LOTE);
      const resultados = await Promise.all(
        lote.map((id) => this.nombreTercero(id)),
      );
      lote.forEach((id, j) => nombres.set(id, resultados[j]));
    }

    const conDependencia = comentarios.some((c) => c.dependencia_id != null);
    const dependencias = conDependencia
      ? await this.nombresDependencias()
      : new Map();

    return comentarios.map((c) => {
      const usuarioId = Number(c.usuario_id);
      const dependenciaId =
        c.dependencia_id != null ? Number(c.dependencia_id) : null;
      return {
        _id: String(c._id),
        accion_mejora_id: String(c.accion_mejora_id?._id ?? c.accion_mejora_id),
        mensaje: c.mensaje,
        fecha_creacion: c.fecha_creacion,
        usuario_id: usuarioId,
        usuario_nombre: nombres.get(usuarioId) ?? `Usuario ${usuarioId}`,
        usuario_rol: c.usuario_rol,
        rol_nombre: ETIQUETAS_ROL[c.usuario_rol] ?? c.usuario_rol,
        dependencia_id: dependenciaId,
        dependencia_nombre:
          dependenciaId != null
            ? (dependencias.get(dependenciaId) ?? null)
            : null,
      };
    });
  }

  /** El nombre del autor es un dato opcional: si Terceros falla se muestra "Usuario <id>". */
  private async nombreTercero(usuarioId: number): Promise<string | null> {
    try {
      const tercero = await this.tercerosHelper.getTerceroById(
        String(usuarioId),
      );
      const nombre: string | undefined = tercero?.NombreCompleto;
      return nombre
        ? nombre
            .toLowerCase()
            .replace(/(^|\s)\p{L}/gu, (letra) => letra.toUpperCase())
        : null;
    } catch (error) {
      this.logger.warn(
        `No se pudo resolver el tercero ${usuarioId}: ${error?.message}`,
      );
      return null;
    }
  }

  private async nombresDependencias(): Promise<Map<number, string>> {
    try {
      const dominio: any = await lastValueFrom(
        this.dominiosService.getDependencias(),
      );
      const lista = dominio?.parametros ?? [];
      return new Map(lista.map((d: any) => [Number(d.Id), d.Nombre]));
    } catch (error) {
      this.logger.warn(
        `No se pudieron resolver las dependencias: ${error?.message}`,
      );
      return new Map();
    }
  }

  private validarAccionId(accionId: string) {
    if (!accionId || !OBJECT_ID.test(accionId)) {
      throw new BadRequestException(
        'El id de la acción de mejora no es válido',
      );
    }
  }

  private entero(valor: any, porDefecto: number, campo: string): number {
    if (valor === undefined || valor === null || valor === '')
      return porDefecto;
    const numero = Number(valor);
    if (!Number.isInteger(numero) || numero < 0) {
      throw new BadRequestException(
        `${campo} debe ser un entero mayor o igual a 0`,
      );
    }
    return numero;
  }
}
