/**
 * Validación de hallazgos de auditorías externas (#953).
 *
 * Función pura: no consulta servicios ni escribe. Quien la llama (registro
 * manual o validación del cargue masivo) entrega los dominios ya cargados
 * (vigencias y dependencias válidas) y recibe los hallazgos normalizados o la
 * lista completa de errores. Nunca se detiene en el primer error, para poder
 * mostrar al auditor todo lo que debe corregir de una vez.
 */

/** Máximo de hallazgos por registro o archivo. */
export const MAX_HALLAZGOS_EXTERNOS = 500;

const MAX_CODIGO = 50;
const MAX_NUMERAL = 50;
const MAX_DESCRIPCION = 2000;

/** Fila tal como llega del formulario o del archivo (todo opcional hasta validar). */
export interface HallazgoExternoEntrada {
  vigencia_pad?: unknown;
  codigo_auditoria_pad?: unknown;
  numeral?: unknown;
  descripcion?: unknown;
  dependencia_id?: unknown;
}

/** Hallazgo listo para persistir: `titulo` y `descripcion` llevan el mismo texto. */
export interface HallazgoExternoNormalizado {
  vigencia_pad: number;
  codigo_auditoria_pad: string;
  numeral: string;
  titulo: string;
  descripcion: string;
  dependencia_id: number[];
}

export interface ErrorValidacionHallazgo {
  /** Número de fila (1 = primer hallazgo; 0 = error que afecta a todo el conjunto). */
  fila: number;
  campo: string;
  motivo: string;
}

export interface DominiosHallazgoExterno {
  vigencias: Iterable<number>;
  dependencias: Iterable<number>;
}

export interface OpcionesValidacionHallazgo {
  /** Número de la primera fila en el origen (en un xlsx con encabezado, 2). Por defecto 1. */
  primeraFila?: number;
  maxFilas?: number;
}

export interface ResultadoValidacionHallazgos {
  hallazgos: HallazgoExternoNormalizado[];
  errores: ErrorValidacionHallazgo[];
}

function texto(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  return String(valor).trim();
}

function entero(valor: unknown): number | null {
  const t = texto(valor);
  if (!/^\d+$/.test(t)) return null;
  return Number(t);
}

/** Acepta arreglo, número suelto o texto separado por `|` (formato del cargue masivo). */
function listaDeIds(valor: unknown): { ids: number[]; invalidos: string[] } {
  const partes: unknown[] = Array.isArray(valor)
    ? valor
    : typeof valor === 'string'
      ? valor.split('|')
      : valor === null || valor === undefined
        ? []
        : [valor];
  const ids: number[] = [];
  const invalidos: string[] = [];
  for (const parte of partes) {
    const t = texto(parte);
    if (!t) continue;
    const n = entero(t);
    if (n === null) invalidos.push(t);
    else if (!ids.includes(n)) ids.push(n);
  }
  return { ids, invalidos };
}

export function validarHallazgosExternos(
  filas: HallazgoExternoEntrada[],
  dominios: DominiosHallazgoExterno,
  opciones: OpcionesValidacionHallazgo = {},
): ResultadoValidacionHallazgos {
  const primeraFila = opciones.primeraFila ?? 1;
  const maxFilas = opciones.maxFilas ?? MAX_HALLAZGOS_EXTERNOS;
  const errores: ErrorValidacionHallazgo[] = [];
  const hallazgos: HallazgoExternoNormalizado[] = [];

  if (!filas?.length) {
    errores.push({
      fila: 0,
      campo: 'hallazgos',
      motivo: 'Debe registrar al menos un hallazgo.',
    });
    return { hallazgos, errores };
  }
  if (filas.length > maxFilas) {
    errores.push({
      fila: 0,
      campo: 'hallazgos',
      motivo: `Se permiten máximo ${maxFilas} hallazgos por registro (recibidos: ${filas.length}).`,
    });
    return { hallazgos, errores };
  }

  const vigencias = new Set(dominios.vigencias);
  const dependencias = new Set(dominios.dependencias);
  const vistos = new Map<string, number>();

  filas.forEach((entrada, indice) => {
    const fila = primeraFila + indice;
    const antes = errores.length;
    const error = (campo: string, motivo: string) =>
      errores.push({ fila, campo, motivo });

    const vigencia = entero(entrada?.vigencia_pad);
    if (!texto(entrada?.vigencia_pad)) {
      error('vigencia_pad', 'La vigencia es obligatoria.');
    } else if (vigencia === null || !vigencias.has(vigencia)) {
      error(
        'vigencia_pad',
        `La vigencia "${texto(entrada.vigencia_pad)}" no existe.`,
      );
    }

    const codigo = texto(entrada?.codigo_auditoria_pad);
    if (!codigo) {
      error(
        'codigo_auditoria_pad',
        'El código de la auditoría es obligatorio.',
      );
    } else if (codigo.length > MAX_CODIGO) {
      error(
        'codigo_auditoria_pad',
        `El código de la auditoría supera ${MAX_CODIGO} caracteres.`,
      );
    }

    const numeral = texto(entrada?.numeral);
    if (!numeral) {
      error('numeral', 'El número de hallazgo es obligatorio.');
    } else if (numeral.length > MAX_NUMERAL) {
      error(
        'numeral',
        `El número de hallazgo supera ${MAX_NUMERAL} caracteres.`,
      );
    }

    const descripcion = texto(entrada?.descripcion);
    if (!descripcion) {
      error('descripcion', 'La descripción del hallazgo es obligatoria.');
    } else if (descripcion.length > MAX_DESCRIPCION) {
      error(
        'descripcion',
        `La descripción supera ${MAX_DESCRIPCION} caracteres.`,
      );
    }

    const { ids, invalidos } = listaDeIds(entrada?.dependencia_id);
    if (!ids.length && !invalidos.length) {
      error(
        'dependencia_id',
        'Debe indicar al menos una dependencia responsable.',
      );
    }
    for (const invalido of invalidos) {
      error('dependencia_id', `La dependencia "${invalido}" no es válida.`);
    }
    for (const id of ids) {
      if (!dependencias.has(id)) {
        error('dependencia_id', `La dependencia ${id} no existe.`);
      }
    }

    if (codigo && numeral) {
      const clave = `${codigo.toLowerCase()}|${numeral.toLowerCase()}`;
      const primera = vistos.get(clave);
      if (primera !== undefined) {
        error(
          'numeral',
          `El hallazgo "${numeral}" de la auditoría "${codigo}" ya está en la fila ${primera}.`,
        );
      } else {
        vistos.set(clave, fila);
      }
    }

    if (errores.length === antes) {
      hallazgos.push({
        vigencia_pad: vigencia as number,
        codigo_auditoria_pad: codigo,
        numeral,
        titulo: descripcion,
        descripcion,
        dependencia_id: ids,
      });
    }
  });

  return { hallazgos: errores.length ? [] : hallazgos, errores };
}
