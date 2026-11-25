import { BadRequestException, Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { firstValueFrom } from 'rxjs';
import { environment } from 'src/config/configuration';
import { DominiosService } from 'src/shared/utils/dominios/dominios.service';
import { base64ToArrayBuffer } from 'src/shared/utils/base64.utils';
import {
  HallazgoExternoEntrada,
  MAX_HALLAZGOS_EXTERNOS,
  validarHallazgosExternos,
} from 'src/shared/utils/validar-hallazgo-externo.util';

const { TIPO_PARAMETRO } = environment;

/** Encabezados de la plantilla de hallazgos de auditorías externas (fila 1). */
export const COLUMNAS_HALLAZGOS_EXTERNOS = {
  vigencia_pad: 'Vigencia',
  codigo_auditoria_pad: 'Código de Auditoría',
  numeral: 'No. Hallazgo',
  descripcion: 'Descripción',
  dependencia_id: 'Dependencias',
} as const;

type CampoColumna = keyof typeof COLUMNAS_HALLAZGOS_EXTERNOS;

/** Tamaño máximo del archivo: 5 MB (en Base64 ocupa un tercio más). */
const MAX_BASE64 = Math.ceil((5 * 1024 * 1024 * 4) / 3);
/** Separador de varias dependencias en una celda (igual que el cargue del plan anual). */
const SEPARADOR_DEPENDENCIAS = '|';

export interface ErrorArchivoHallazgo {
  /** Fila del archivo (la 1 es el encabezado); 0 si el error es de todo el archivo. */
  fila: number;
  columna: string;
  motivo: string;
}

export interface HallazgoExternoValidado {
  /** Fila del archivo de donde salió el hallazgo (la 1 es el encabezado). */
  fila: number;
  vigencia_pad: number;
  vigencia_nombre: string;
  codigo_auditoria_pad: string;
  numeral: string;
  descripcion: string;
  dependencia_id: number[];
  dependencias_nombre: string[];
}

export interface ResultadoValidacionArchivo {
  total: number;
  hallazgos: HallazgoExternoValidado[];
}

/** Minúsculas, sin tildes y sin espacios repetidos: para comparar nombres y encabezados. */
function normalizar(valor: unknown): string {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Texto visible de una celda de ExcelJS (texto, número, fórmula, texto enriquecido, enlace). */
function textoDeCelda(valor: ExcelJS.CellValue): string {
  if (valor === null || valor === undefined) return '';
  if (valor instanceof Date) return valor.toISOString();
  if (typeof valor !== 'object') return String(valor).trim();
  const objeto = valor as unknown as Record<string, any>;
  if (Array.isArray(objeto.richText)) {
    return objeto.richText
      .map((t: { text: string }) => t.text)
      .join('')
      .trim();
  }
  if ('result' in objeto) return textoDeCelda(objeto.result);
  if ('text' in objeto) return textoDeCelda(objeto.text);
  return '';
}

/**
 * Lee y valida el archivo de cargue masivo de hallazgos de auditorías externas (#953).
 * No guarda nada: devuelve los hallazgos normalizados para la vista previa o lanza
 * `BadRequestException` con todos los errores por fila (todo o nada).
 */
@Injectable()
export class CargueMasivoExternaService {
  constructor(private readonly dominiosService: DominiosService) {}

  async validarArchivo(
    base64data: string,
  ): Promise<ResultadoValidacionArchivo> {
    this.validarEntrada(base64data);
    const hoja = await this.leerHoja(base64data);
    const columnas = this.ubicarColumnas(hoja);
    const { filas, filasOrigen } = this.leerFilas(hoja, columnas);

    const [vigencias, dependencias] = await Promise.all([
      firstValueFrom(
        this.dominiosService.getParametros(TIPO_PARAMETRO.VIGENCIA),
      ),
      firstValueFrom(this.dominiosService.getDependencias()),
    ]);
    const idPorVigencia = this.mapaPorNombre(vigencias.parametros);
    const idPorDependencia = this.mapaPorNombre(dependencias.parametros);

    // Los nombres del archivo se traducen a ids; lo que no se reconoce pasa tal cual
    // y el helper lo reporta como inexistente.
    const entradas: HallazgoExternoEntrada[] = filas.map((fila) => ({
      ...fila,
      vigencia_pad:
        idPorVigencia.get(normalizar(fila.vigencia_pad)) ?? fila.vigencia_pad,
      dependencia_id: String(fila.dependencia_id ?? '')
        .split(SEPARADOR_DEPENDENCIAS)
        .map((nombre) => nombre.trim())
        .filter(Boolean)
        .map((nombre) => idPorDependencia.get(normalizar(nombre)) ?? nombre),
    }));

    const { hallazgos, errores } = validarHallazgosExternos(
      entradas,
      {
        vigencias: vigencias.parametros.map((p) => p.Id),
        dependencias: dependencias.parametros.map((p) => p.Id),
      },
      { numerosDeFila: filasOrigen },
    );

    if (errores.length) {
      const erroresArchivo: ErrorArchivoHallazgo[] = errores.map((e) => ({
        fila: e.fila,
        columna:
          e.fila === 0
            ? 'Archivo'
            : (COLUMNAS_HALLAZGOS_EXTERNOS[e.campo as CampoColumna] ?? e.campo),
        motivo: e.motivo,
      }));
      throw new BadRequestException({
        message:
          'El archivo contiene errores. No se cargó ningún hallazgo; corrija el archivo y vuelva a cargarlo.',
        errores: erroresArchivo,
      });
    }

    const nombreVigencia = new Map(
      vigencias.parametros.map((p) => [p.Id, p.Nombre]),
    );
    const nombreDependencia = new Map(
      dependencias.parametros.map((p) => [p.Id, p.Nombre]),
    );
    const validados = hallazgos.map<HallazgoExternoValidado>((h, i) => ({
      fila: filasOrigen[i],
      vigencia_pad: h.vigencia_pad,
      vigencia_nombre:
        nombreVigencia.get(h.vigencia_pad) ?? String(h.vigencia_pad),
      codigo_auditoria_pad: h.codigo_auditoria_pad,
      numeral: h.numeral,
      descripcion: h.descripcion,
      dependencia_id: h.dependencia_id,
      dependencias_nombre: h.dependencia_id.map(
        (id) => nombreDependencia.get(id) ?? String(id),
      ),
    }));

    return { total: validados.length, hallazgos: validados };
  }

  private validarEntrada(base64data: string): void {
    if (typeof base64data !== 'string' || !base64data.trim()) {
      throw new BadRequestException('El archivo es obligatorio.');
    }
    if (base64data.length > MAX_BASE64) {
      throw new BadRequestException(
        'El archivo supera el tamaño máximo de 5 MB.',
      );
    }
  }

  private async leerHoja(base64data: string): Promise<ExcelJS.Worksheet> {
    const libro = new ExcelJS.Workbook();
    try {
      await libro.xlsx.load(base64ToArrayBuffer(base64data));
    } catch {
      throw new BadRequestException(
        'El archivo no es un Excel (.xlsx) válido. Use la plantilla de hallazgos.',
      );
    }
    const hoja = libro.worksheets[0];
    if (!hoja) {
      throw new BadRequestException('El archivo no contiene ninguna hoja.');
    }
    return hoja;
  }

  /** Busca cada encabezado de la plantilla en la fila 1, sin importar el orden ni las tildes. */
  private ubicarColumnas(
    hoja: ExcelJS.Worksheet,
  ): Record<CampoColumna, number> {
    const porEncabezado = new Map<string, number>();
    hoja.getRow(1).eachCell({ includeEmpty: false }, (celda, columna) => {
      porEncabezado.set(normalizar(textoDeCelda(celda.value)), columna);
    });

    const columnas = {} as Record<CampoColumna, number>;
    const faltantes: string[] = [];
    (Object.keys(COLUMNAS_HALLAZGOS_EXTERNOS) as CampoColumna[]).forEach(
      (campo) => {
        const columna = porEncabezado.get(
          normalizar(COLUMNAS_HALLAZGOS_EXTERNOS[campo]),
        );
        if (columna === undefined)
          faltantes.push(COLUMNAS_HALLAZGOS_EXTERNOS[campo]);
        else columnas[campo] = columna;
      },
    );

    if (faltantes.length) {
      throw new BadRequestException(
        `Al archivo le faltan las columnas: ${faltantes.join(', ')}. Use la plantilla de hallazgos.`,
      );
    }
    return columnas;
  }

  /**
   * Lee las filas de datos (desde la 2), omite las vacías y conserva el número de
   * fila original para poder señalarla. Se detiene un poco después del máximo
   * permitido: basta para que el helper rechace el exceso sin leer todo el archivo.
   */
  private leerFilas(
    hoja: ExcelJS.Worksheet,
    columnas: Record<CampoColumna, number>,
  ): { filas: HallazgoExternoEntrada[]; filasOrigen: number[] } {
    const filas: HallazgoExternoEntrada[] = [];
    const filasOrigen: number[] = [];
    const campos = Object.keys(columnas) as CampoColumna[];

    for (let numero = 2; numero <= hoja.rowCount; numero++) {
      const fila = hoja.getRow(numero);
      const entrada: Record<string, string> = {};
      let vacia = true;
      for (const campo of campos) {
        const texto = textoDeCelda(fila.getCell(columnas[campo]).value);
        entrada[campo] = texto;
        if (texto) vacia = false;
      }
      if (vacia) continue;

      filas.push(entrada);
      filasOrigen.push(numero);
      if (filas.length > MAX_HALLAZGOS_EXTERNOS) break;
    }
    return { filas, filasOrigen };
  }

  private mapaPorNombre(
    parametros: { Id: number; Nombre: string }[],
  ): Map<string, number> {
    return new Map(parametros.map((p) => [normalizar(p.Nombre), p.Id]));
  }
}
