/**
 * Numeración jerárquica de hallazgos: {tema}.{subtema}.{hallazgo}.
 *
 * Recorre temas activos → subtemas activos → hallazgos activos por
 * subtema, contando solo activos. El contador de tema arranca en 2
 * (`temaCount + 1`) — convención del front (la sección "1" del informe
 * queda reservada). Debe mantenerse en sync con el util homónimo del
 * frontend (`plan_anual_auditoria_mf`), que se usa solo para display.
 *
 * Esta copia es la FUENTE DE VERDAD del número que se persiste al sellar.
 */
export interface HallazgoNumerado {
  hallazgoId: string;
  numero: string;
}

export function numerarHallazgos(
  temas: any[],
  hallazgos: any[],
): HallazgoNumerado[] {
  const resultado: HallazgoNumerado[] = [];
  let temaCount = 0;

  for (const tema of temas ?? []) {
    if (!tema.activo) continue;
    temaCount++;
    let subtemaCount = 0;

    for (const subtema of tema.subtema ?? []) {
      if (!subtema.activo) continue;
      subtemaCount++;
      let hallazgoCount = 0;

      const subtemaIdStr = subtema._id?.toString();
      for (const h of (hallazgos ?? []).filter(
        (h) =>
          h.subtema_id?.toString() === subtemaIdStr && h.activo !== false,
      )) {
        hallazgoCount++;
        resultado.push({
          hallazgoId: h._id?.toString(),
          numero: `${temaCount + 1}.${subtemaCount}.${hallazgoCount}`,
        });
      }
    }
  }

  return resultado;
}
