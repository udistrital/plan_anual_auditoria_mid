export class Parametro {
  Id: number;
  Nombre: string;
}

export class Dominio {
  api: string;
  nombre: string;
  tipoParametroId?: number;
  parametros: Parametro[];
}
