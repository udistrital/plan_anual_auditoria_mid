/**
 * Indica si un HTML generado por Quill no tiene contenido visible
 * (p. ej. `<p><br></p>`, espacios o `&nbsp;`). Se considera con contenido
 * si incluye imágenes o tablas aunque no tenga texto.
 *
 * Debe mantenerse en sync con el util homónimo del frontend
 * (`plan_anual_auditoria_mf/src/app/shared/utils/html.util.ts`).
 */
export function esHtmlVacio(html: string | null | undefined): boolean {
  if (!html) return true;
  if (/<(img|table|iframe)\b/i.test(html)) return false;
  const texto = html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .trim();
  return texto.length === 0;
}

/** Las descripciones de Quill siempre inician con una etiqueta de bloque; las anteriores son texto plano. */
const INICIO_HTML = /^\s*<(p|ol|ul|h[1-6]|blockquote|pre|div)\b/i;

export function esHtml(valor: string | null | undefined): boolean {
  return !!valor && INICIO_HTML.test(valor);
}

function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Convierte texto plano en párrafos HTML, conservando sus saltos de línea.
 *
 * Debe mantenerse en sync con el util homónimo del frontend
 * (`plan_anual_auditoria_mf/src/app/shared/utils/html.util.ts`).
 */
export function textoPlanoAHtml(texto: string | null | undefined): string {
  const limpio = (texto ?? '').trim();
  if (!limpio) return '';
  return limpio
    .split(/\r?\n/)
    .map((linea) =>
      linea.trim() ? `<p>${escaparHtml(linea)}</p>` : '<p><br></p>',
    )
    .join('');
}
