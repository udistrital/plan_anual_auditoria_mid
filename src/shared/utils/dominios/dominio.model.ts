export class Parametro {
  Id: number;
  Nombre: string;
}

export class Dominio {
  api: string;
  nombre: string;
  parametros: Parametro[];
}
