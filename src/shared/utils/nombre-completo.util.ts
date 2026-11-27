/** Componentes del nombre de un tercero tal como los entrega Terceros */
export interface ComponentesNombreTercero {
  PrimerNombre?: unknown;
  SegundoNombre?: unknown;
  PrimerApellido?: unknown;
  SegundoApellido?: unknown;
}

/**
 * Construye el nombre completo de un tercero en el orden primer nombre, segundo nombre,
 * primer apellido y segundo apellido, sin depender del orden del campo NombreCompleto.
 * Descarta los componentes nulos, indefinidos, vacíos o compuestos solo por espacios.
 * @returns el nombre unido por un único espacio, o una cadena vacía si no hay componentes
 */
export function construirNombreCompleto(
  tercero: ComponentesNombreTercero | null | undefined,
): string {
  if (!tercero) return '';

  return [
    tercero.PrimerNombre,
    tercero.SegundoNombre,
    tercero.PrimerApellido,
    tercero.SegundoApellido,
  ]
    .map((componente) =>
      typeof componente === 'string' ? componente.trim() : '',
    )
    .filter((componente) => componente.length > 0)
    .join(' ');
}

/**
 * Nombre de un tercero para mostrar en vistas, documentos y notificaciones, en orden
 * nombres-apellidos. Si el tercero no trae ningún componente del nombre se usa su
 * NombreCompleto y, si tampoco existe, el texto de respaldo.
 */
export function nombreTercero(
  tercero: (ComponentesNombreTercero & { NombreCompleto?: unknown }) | null | undefined,
  respaldo = '',
): string {
  const nombreCompleto =
    typeof tercero?.NombreCompleto === 'string'
      ? tercero.NombreCompleto.trim().replace(/\s+/g, ' ')
      : '';
  return construirNombreCompleto(tercero) || nombreCompleto || respaldo;
}
