import {
  MAX_HALLAZGOS_EXTERNOS,
  validarHallazgosExternos,
} from './validar-hallazgo-externo.util';
import {
  crearDominios,
  crearFilaHallazgo,
} from '../../../test/fixtures/hallazgo-externo';

describe('validarHallazgosExternos', () => {
  const dominios = crearDominios();

  it('normaliza filas válidas: titulo y descripcion llevan el mismo texto', () => {
    const { hallazgos, errores } = validarHallazgosExternos(
      [
        crearFilaHallazgo({
          codigo_auditoria_pad: '  PAD-1  ',
          vigencia_pad: '2025',
        }),
      ],
      dominios,
    );

    expect(errores).toEqual([]);
    expect(hallazgos).toEqual([
      {
        vigencia_pad: 2025,
        codigo_auditoria_pad: 'PAD-1',
        numeral: '3.1.2',
        titulo: 'Deficiencias en la supervisión del contrato',
        descripcion: 'Deficiencias en la supervisión del contrato',
        dependencia_id: [32],
      },
    ]);
  });

  it('acepta dependencias como arreglo, número suelto o texto separado por |', () => {
    const { hallazgos, errores } = validarHallazgosExternos(
      [
        crearFilaHallazgo({ numeral: '1', dependencia_id: [32, 45] }),
        crearFilaHallazgo({ numeral: '2', dependencia_id: 60 }),
        crearFilaHallazgo({ numeral: '3', dependencia_id: '32|45 | 60' }),
      ],
      dominios,
    );

    expect(errores).toEqual([]);
    expect(hallazgos.map((h) => h.dependencia_id)).toEqual([
      [32, 45],
      [60],
      [32, 45, 60],
    ]);
  });

  it('elimina dependencias repetidas dentro de una fila', () => {
    const { hallazgos } = validarHallazgosExternos(
      [crearFilaHallazgo({ dependencia_id: [32, 32, '32'] })],
      dominios,
    );

    expect(hallazgos[0].dependencia_id).toEqual([32]);
  });

  it('reporta todos los obligatorios vacíos de una fila, sin detenerse en el primero', () => {
    const { hallazgos, errores } = validarHallazgosExternos([{}], dominios);

    expect(hallazgos).toEqual([]);
    expect(errores.map((e) => e.campo)).toEqual([
      'vigencia_pad',
      'codigo_auditoria_pad',
      'numeral',
      'descripcion',
      'dependencia_id',
    ]);
    expect(errores.every((e) => e.fila === 1)).toBe(true);
  });

  it('rechaza vigencia inexistente o no numérica', () => {
    const { errores } = validarHallazgosExternos(
      [
        crearFilaHallazgo({ numeral: '1', vigencia_pad: 1999 }),
        crearFilaHallazgo({ numeral: '2', vigencia_pad: 'abc' }),
      ],
      dominios,
    );

    expect(errores).toEqual([
      {
        fila: 1,
        campo: 'vigencia_pad',
        motivo: 'La vigencia "1999" no existe.',
      },
      {
        fila: 2,
        campo: 'vigencia_pad',
        motivo: 'La vigencia "abc" no existe.',
      },
    ]);
  });

  it('rechaza dependencias inexistentes y valores no numéricos', () => {
    const { errores } = validarHallazgosExternos(
      [crearFilaHallazgo({ dependencia_id: [32, 999, 'xyz'] })],
      dominios,
    );

    expect(errores).toEqual([
      {
        fila: 1,
        campo: 'dependencia_id',
        motivo: 'La dependencia "xyz" no es válida.',
      },
      {
        fila: 1,
        campo: 'dependencia_id',
        motivo: 'La dependencia 999 no existe.',
      },
    ]);
  });

  it('detecta duplicados por código de auditoría + número de hallazgo, sin distinguir mayúsculas', () => {
    const { errores } = validarHallazgosExternos(
      [
        crearFilaHallazgo({ codigo_auditoria_pad: 'PAD-1', numeral: 'A.1' }),
        crearFilaHallazgo({ codigo_auditoria_pad: 'pad-1', numeral: 'a.1' }),
        crearFilaHallazgo({ codigo_auditoria_pad: 'PAD-2', numeral: 'A.1' }),
      ],
      dominios,
    );

    expect(errores).toEqual([
      {
        fila: 2,
        campo: 'numeral',
        motivo:
          'El hallazgo "a.1" de la auditoría "pad-1" ya está en la fila 1.',
      },
    ]);
  });

  it('numera las filas desde primeraFila (xlsx con encabezado: 2)', () => {
    const { errores } = validarHallazgosExternos(
      [crearFilaHallazgo(), crearFilaHallazgo({ numeral: '' })],
      dominios,
      { primeraFila: 2 },
    );

    expect(errores).toEqual([
      {
        fila: 3,
        campo: 'numeral',
        motivo: 'El número de hallazgo es obligatorio.',
      },
    ]);
  });

  it('rechaza textos que superan el largo permitido', () => {
    const { errores } = validarHallazgosExternos(
      [
        crearFilaHallazgo({
          codigo_auditoria_pad: 'x'.repeat(51),
          numeral: 'y'.repeat(51),
          descripcion: 'z'.repeat(2001),
        }),
      ],
      dominios,
    );

    expect(errores.map((e) => e.campo)).toEqual([
      'codigo_auditoria_pad',
      'numeral',
      'descripcion',
    ]);
  });

  it('exige al menos un hallazgo', () => {
    const { hallazgos, errores } = validarHallazgosExternos([], dominios);

    expect(hallazgos).toEqual([]);
    expect(errores).toEqual([
      {
        fila: 0,
        campo: 'hallazgos',
        motivo: 'Debe registrar al menos un hallazgo.',
      },
    ]);
  });

  it(`rechaza más de ${MAX_HALLAZGOS_EXTERNOS} hallazgos`, () => {
    const filas = Array.from({ length: MAX_HALLAZGOS_EXTERNOS + 1 }, (_, i) =>
      crearFilaHallazgo({ numeral: String(i) }),
    );

    const { hallazgos, errores } = validarHallazgosExternos(filas, dominios);

    expect(hallazgos).toEqual([]);
    expect(errores).toHaveLength(1);
    expect(errores[0]).toMatchObject({ fila: 0, campo: 'hallazgos' });
  });

  it('no devuelve hallazgos parciales cuando hay algún error (todo o nada)', () => {
    const { hallazgos, errores } = validarHallazgosExternos(
      [crearFilaHallazgo({ numeral: '1' }), crearFilaHallazgo({ numeral: '' })],
      dominios,
    );

    expect(errores).toHaveLength(1);
    expect(hallazgos).toEqual([]);
  });

  it('no modifica las filas de entrada', () => {
    const fila = crearFilaHallazgo({ dependencia_id: '32|45' });
    const copia = JSON.parse(JSON.stringify(fila));

    validarHallazgosExternos([fila], dominios);

    expect(fila).toEqual(copia);
  });
});
