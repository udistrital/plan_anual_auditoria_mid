import {
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { environment } from 'src/config/configuration';
import { NuxeoService } from 'src/shared/services/nuxeo.service';
import { setupValidationDomains } from 'src/shared/utils/auditoriasExcel.utils';
import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
} from 'src/shared/utils/base64.utils';
import { DominiosService } from 'src/shared/utils/dominios/dominios.service';
import { MAX_HALLAZGOS_EXTERNOS } from 'src/shared/utils/validar-hallazgo-externo.util';
import { COLUMNAS_HALLAZGOS_EXTERNOS } from './cargue-masivo-externa.service';

const { TIPO_PARAMETRO } = environment;

const ENCABEZADOS = Object.values(COLUMNAS_HALLAZGOS_EXTERNOS) as string[];
const COLUMNA_VIGENCIA = COLUMNAS_HALLAZGOS_EXTERNOS.vigencia_pad;
const COLUMNA_DEPENDENCIAS = COLUMNAS_HALLAZGOS_EXTERNOS.dependencia_id;

/** Nombres únicos y ordenados, sin vacíos. */
const nombresOrdenados = (parametros: { Nombre: string }[]): string[] =>
  [...new Set(parametros.map((p) => String(p.Nombre ?? '').trim()))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));

/**
 * Plantilla del cargue masivo de hallazgos de auditorías externas (#953). El archivo base vive
 * en Nuxeo, como las demás plantillas; aquí se le agregan las listas de vigencias (con validación
 * de celda) y de dependencias (solo de consulta: una celda admite varias separadas por `|`).
 */
@Injectable()
export class PlantillaHallazgosExternosService {
  constructor(
    private readonly nuxeoService: NuxeoService,
    private readonly dominiosService: DominiosService,
  ) {}

  async obtener(): Promise<{ base64: string }> {
    const uuid = environment.PLANTILLA_CARGUE_MASIVO_HALLAZGOS_EXTERNOS;
    if (!uuid) {
      throw new ServiceUnavailableException(
        'La plantilla de hallazgos de auditorías externas aún no está disponible en este ambiente.',
      );
    }

    const [plantilla, vigencias, dependencias] = await Promise.all([
      firstValueFrom(this.nuxeoService.obtenerPorUUID(uuid)),
      firstValueFrom(
        this.dominiosService.getParametros(TIPO_PARAMETRO.VIGENCIA),
      ),
      firstValueFrom(this.dominiosService.getDependencias()),
    ]);
    if (!plantilla) {
      throw new HttpException(
        'No se pudo obtener la plantilla del gestor documental.',
        HttpStatus.BAD_GATEWAY,
      );
    }

    const conListas = await setupValidationDomains(
      {
        [COLUMNA_VIGENCIA]: nombresOrdenados(vigencias.parametros),
        [COLUMNA_DEPENDENCIAS]: nombresOrdenados(dependencias.parametros),
      },
      [{ sheetIndex: 0, length: MAX_HALLAZGOS_EXTERNOS }],
      base64ToArrayBuffer(plantilla),
      { headers: ENCABEZADOS, sinValidacion: [COLUMNA_DEPENDENCIAS] },
    );
    return { base64: arrayBufferToBase64(conListas) };
  }
}
