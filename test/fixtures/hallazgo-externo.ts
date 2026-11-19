import type {
  DominiosHallazgoExterno,
  HallazgoExternoEntrada,
} from '../../src/shared/utils/validar-hallazgo-externo.util';

/** Fila de hallazgo externo válida; cada prueba sobrescribe solo lo que necesita. */
export const crearFilaHallazgo = (
  datos: Partial<HallazgoExternoEntrada> = {},
): HallazgoExternoEntrada => ({
  vigencia_pad: 2025,
  codigo_auditoria_pad: 'PAD-2025-01',
  numeral: '3.1.2',
  descripcion: 'Deficiencias en la supervisión del contrato',
  dependencia_id: [32],
  ...datos,
});

/** Dominios de ejemplo: dos vigencias y tres dependencias. */
export const crearDominios = (
  datos: Partial<DominiosHallazgoExterno> = {},
): DominiosHallazgoExterno => ({
  vigencias: [2024, 2025],
  dependencias: [32, 45, 60],
  ...datos,
});
