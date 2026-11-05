/**
 * Descripciones de texto enriquecido guardadas en el gestor documental.
 *
 * Cuando una descripción (tema o subtema del informe) tiene imágenes, el MF guarda su HTML en Nuxeo y en
 * el CRUD queda `NuxeoEnlace:<uuid>`. Para generar el PDF hay que reemplazar ese enlace por el HTML.
 */

const PREFIJO_ENLACE = 'NuxeoEnlace';

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
        subtemas?.some((sub) => esEnlaceNuxeo(sub?.descripcion)) ??
        false;
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
