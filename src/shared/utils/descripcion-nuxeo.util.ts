/**
 * Descripciones de texto enriquecido guardadas en el gestor documental.
 *
 * Cuando una descripción (tema, subtema o hallazgo del informe) tiene imágenes, el MF guarda su HTML en Nuxeo y en
 * el CRUD queda `NuxeoEnlace:<uuid>`. Para generar el PDF hay que reemplazar ese enlace por el HTML.
 */

import { esHtml, esHtmlVacio, textoPlanoAHtml } from './html.util';

const PREFIJO_ENLACE = 'NuxeoEnlace';

/** Se muestra en el PDF en lugar de la descripción de un hallazgo que el gestor no entregó. */
export const DESCRIPCION_HALLAZGO_NO_DISPONIBLE =
  '<p>Descripción no disponible en el gestor documental.</p>';

/** Devuelve el contenido (base64) del documento con ese uuid, o '' si no se pudo obtener. */
export type ObtenerContenidoNuxeo = (uuid: string) => Promise<string>;

export function esEnlaceNuxeo(descripcion: unknown): descripcion is string {
  return (
    typeof descripcion === 'string' && descripcion.startsWith(PREFIJO_ENLACE)
  );
}

export function uuidDeEnlace(enlace: string): string {
  return enlace.substring(enlace.indexOf(':') + 1);
}

/** El gestor documental devuelve el HTML codificado en base64 (UTF-8). */
export function decodificarHtmlBase64(contenido: string): string {
  return Buffer.from(contenido ?? '', 'base64').toString('utf-8');
}

async function resolverDescripcion(
  descripcion: string,
  obtener: ObtenerContenidoNuxeo,
): Promise<string> {
  return decodificarHtmlBase64(await obtener(uuidDeEnlace(descripcion)));
}

/**
 * Reemplaza el `NuxeoEnlace` de `descripcion_titulo` de cada tema y de `descripcion` de cada uno de sus
 * subtemas por el HTML del gestor documental.
 * - Conserva el orden de los temas y subtemas.
 * - No modifica los objetos recibidos: los que no tienen enlace se devuelven tal cual.
 * - Si el gestor no entrega el documento (`obtener` devuelve ''), la descripción queda vacía y el informe
 *   se genera igual; el error ya lo registra quien consulta el gestor.
 */
export async function resolverDescripcionesTemas<T extends Record<string, any>>(
  temas: T[],
  obtener: ObtenerContenidoNuxeo,
): Promise<T[]> {
  return Promise.all(
    (temas ?? []).map(async (tema) => {
      const descripcionTema = esEnlaceNuxeo(tema.descripcion_titulo)
        ? await resolverDescripcion(tema.descripcion_titulo, obtener)
        : undefined;

      const subtemas: any[] | undefined = Array.isArray(tema.subtema)
        ? tema.subtema
        : undefined;
      const conEnlace =
        subtemas?.some((sub) => esEnlaceNuxeo(sub?.descripcion)) ?? false;
      const subtemasResueltos = conEnlace
        ? await Promise.all(
            subtemas!.map(async (sub) =>
              esEnlaceNuxeo(sub?.descripcion)
                ? {
                    ...sub,
                    descripcion: await resolverDescripcion(
                      sub.descripcion,
                      obtener,
                    ),
                  }
                : sub,
            ),
          )
        : undefined;

      if (descripcionTema === undefined && subtemasResueltos === undefined)
        return tema;
      return {
        ...tema,
        ...(descripcionTema !== undefined && {
          descripcion_titulo: descripcionTema,
        }),
        ...(subtemasResueltos !== undefined && { subtema: subtemasResueltos }),
      };
    }),
  );
}

/** Convierte a HTML la descripción de un hallazgo, sea cual sea su formato (texto plano, HTML o enlace). */
async function descripcionHallazgoAHtml(
  descripcion: unknown,
  obtener: ObtenerContenidoNuxeo,
): Promise<string> {
  if (esEnlaceNuxeo(descripcion)) {
    const html = await resolverDescripcion(descripcion, obtener);
    return esHtmlVacio(html) ? DESCRIPCION_HALLAZGO_NO_DISPONIBLE : html;
  }
  const valor = typeof descripcion === 'string' ? descripcion : '';
  if (esHtml(valor)) return esHtmlVacio(valor) ? '' : valor;
  return textoPlanoAHtml(valor);
}

/**
 * Deja en HTML la `descripcion` de cada hallazgo, lista para la plantilla.
 * - Conserva el orden y no modifica los objetos recibidos.
 * - A diferencia de tema y subtema, si el gestor no entrega el documento se muestra un aviso visible:
 *   el hallazgo no tiene otro texto y su descripción es obligatoria. El informe se genera igual.
 */
export async function resolverDescripcionesHallazgos<
  T extends Record<string, any>,
>(hallazgos: T[], obtener: ObtenerContenidoNuxeo): Promise<T[]> {
  return Promise.all(
    (hallazgos ?? []).map(async (hallazgo) => ({
      ...hallazgo,
      descripcion: await descripcionHallazgoAHtml(
        hallazgo.descripcion,
        obtener,
      ),
    })),
  );
}
