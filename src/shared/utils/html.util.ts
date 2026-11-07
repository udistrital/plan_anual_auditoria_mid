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
