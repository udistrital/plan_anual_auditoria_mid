/**
 * Reemplaza el valor de `campo` en `element` por un objeto `{ id, nombre }`
 * buscando en `array` por `param.Id`. Elimina el campo original.
 */
export function reemplazar(
  array: any[],
  element: any,
  campo: string,
  campoNuevo: string,
) {
  const value = element[campo];
  if (Array.isArray(value)) {
    element[campoNuevo] = value.map((id) => {
      const encontrado = array.find((param) => param.Id === id);
      return encontrado
        ? { id, nombre: encontrado.Nombre }
        : { id, nombre: null };
    });
  } else {
    const encontrado = array.find((param) => param.Id === value);
    if (encontrado) {
      element[campoNuevo] = { id: value, nombre: encontrado.Nombre };
    } else {
      console.warn(`No se encontró ${campo} para ID: ${value}`);
      element[campoNuevo] = { id: value, nombre: null };
    }
  }
  delete element[campo];
  return element;
}

/**
 * Reemplaza el valor de `element.usuario_rol` por su etiqueta legible
 * usando el mapa de `roles` provisto.
 */
export function reemplazarCampoRol(
  element: any,
  roles: Record<string, string>,
) {
  if (element.usuario_rol && roles[element.usuario_rol]) {
    element.usuario_rol = roles[element.usuario_rol];
  }
}