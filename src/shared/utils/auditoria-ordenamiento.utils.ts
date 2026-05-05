/**
 * Ordena auditorías según el orden especificado en el plan.
 * Las auditorías que están en el orden del plan se colocan primero,
 * seguidas de las auditorías restantes que no están en el orden.
 *
 * @param auditorias - Array de auditorías a ordenar
 * @param auditoriasOrden - Array de IDs que especifica el orden deseado
 * @returns Array de auditorías ordenadas
 */
export function ordenarAuditoriasPorPlan(
  auditorias: any[],
  auditoriasOrden: string[],
): any[] {
  const auditoriasMap = new Map(
    auditorias.map((auditoria) => [auditoria._id, auditoria]),
  );
  const ordenSet = new Set(auditoriasOrden);

  const ordenadas = auditoriasOrden
    .map((id) => auditoriasMap.get(id))
    .filter((auditoria) => auditoria !== undefined);

  const restantes = auditorias.filter(
    (auditoria) => !ordenSet.has(auditoria._id),
  );

  return [...ordenadas, ...restantes];
}

/**
 * Aplica ordenamiento por campo específico (tipo_evaluacion o titulo).
 *
 * @param auditorias - Array de auditorías a ordenar
 * @param orderBy - Campo por el cual ordenar ('tipo_evaluacion' o 'titulo')
 * @param orderDirection - Dirección del ordenamiento ('ASC' o 'DESC'), por defecto 'ASC'
 * @returns Array de auditorías ordenadas
 */
export function aplicarOrdenamiento(
  auditorias: any[],
  orderBy: string,
  orderDirection: string = 'ASC',
): any[] {
  return auditorias.sort((a, b) => {
    let valorA, valorB;

    if (orderBy === 'tipo_evaluacion') {
      valorA = (a.tipo_evaluacion_nombre || '').toLowerCase();
      valorB = (b.tipo_evaluacion_nombre || '').toLowerCase();
    } else if (orderBy === 'titulo') {
      valorA = (a.titulo || '').toLowerCase();
      valorB = (b.titulo || '').toLowerCase();
    } else {
      return 0;
    }

    if (valorA < valorB) return orderDirection === 'ASC' ? -1 : 1;
    if (valorA > valorB) return orderDirection === 'ASC' ? 1 : -1;
    return 0;
  });
}
