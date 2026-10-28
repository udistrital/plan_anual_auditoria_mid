export interface HallazgoNumeracion {
  _id: string;
  no_hallazgo?: string | null;
}

export interface AccionNumeracion {
  _id: string;
  hallazgo_id: string | { _id: string };
}

export interface NumeroAccion {
  accionId: string;
  no_accion: string;
}

const idDe = (ref: string | { _id: string } | null | undefined): string =>
  (typeof ref === 'object' ? ref?._id : ref) ?? '';

const compararId = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Genera el no_accion de cada acción del plan: VIGENCIA-No.AUDITORIA-No.HALLAZGO-CONSECUTIVO.
 * Respeta el orden de la tabla del plan: hallazgos del informe por _id y, dentro de cada uno,
 * acciones por _id. El consecutivo recorre todo el plan (1..N), no se reinicia por hallazgo.
 * Si un hallazgo no tiene no_hallazgo se usa su posición en el informe (igual que la tabla).
 * @param hallazgos Hallazgos activos del informe de la auditoría.
 * @throws Error si una acción apunta a un hallazgo que no está en el informe.
 */
export function generarNumerosAccion(
  vigencia: string,
  noAuditoria: string | number,
  hallazgos: HallazgoNumeracion[],
  acciones: AccionNumeracion[],
): NumeroAccion[] {
  const hallazgosOrdenados = [...hallazgos].sort((a, b) => compararId(a._id, b._id));
  const posicion = new Map(hallazgosOrdenados.map((h, i) => [h._id, i]));

  const sinHallazgo = acciones.filter((a) => !posicion.has(idDe(a.hallazgo_id)));
  if (sinHallazgo.length) {
    throw new Error(
      `Acciones sin hallazgo en el informe: ${sinHallazgo.map((a) => a._id).join(', ')}`,
    );
  }

  const accionesOrdenadas = [...acciones].sort(
    (a, b) =>
      posicion.get(idDe(a.hallazgo_id))! - posicion.get(idDe(b.hallazgo_id))! ||
      compararId(a._id, b._id),
  );

  return accionesOrdenadas.map((accion, i) => {
    const indice = posicion.get(idDe(accion.hallazgo_id))!;
    const noHallazgo =
      hallazgosOrdenados[indice].no_hallazgo?.trim() || String(indice + 1);
    return {
      accionId: accion._id,
      no_accion: `${vigencia}-${noAuditoria}-${noHallazgo.replace(/\./g, '')}-${i + 1}`,
    };
  });
}
