export function capitalize(nombre: string): string {
  return nombre
    .toLowerCase()
    .split(' ')
    .map(
      (palabra) => palabra.charAt(0).toLocaleUpperCase('es') + palabra.slice(1),
    )
    .join(' ');
}

export function unirListaNombres(nombres: string[]): string {
  if (nombres.length === 1) return nombres[0];
  if (nombres.length === 2) return `${nombres[0]} y ${nombres[1]}`;

  const todosMenosUltimo = nombres.slice(0, -1).join(', ');
  return `${todosMenosUltimo} y ${nombres[nombres.length - 1]}`;
}

export function unirListaNombresConComas(nombres: string[]): string {
  return nombres.join(', ');
}
