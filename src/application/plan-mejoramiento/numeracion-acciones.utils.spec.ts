import { generarNumerosAccion } from './numeracion-acciones.utils';

describe('generarNumerosAccion', () => {
  const hallazgos = [
    { _id: 'h2', no_hallazgo: '3.1.2' },
    { _id: 'h1', no_hallazgo: '3.1.1' },
  ];

  it('genera VIGENCIA-AUDITORIA-HALLAZGO-CONSECUTIVO quitando los puntos del hallazgo', () => {
    const numeros = generarNumerosAccion('2026', 24, hallazgos, [
      { _id: 'a1', hallazgo_id: 'h1' },
    ]);
    expect(numeros).toEqual([{ accionId: 'a1', no_accion: '2026-24-311-1' }]);
  });

  it('ordena hallazgos y acciones por _id con un consecutivo continuo en todo el plan', () => {
    const numeros = generarNumerosAccion('2026', 24, hallazgos, [
      { _id: 'a3', hallazgo_id: 'h2' },
      { _id: 'a2', hallazgo_id: { _id: 'h1' } },
      { _id: 'a1', hallazgo_id: 'h1' },
    ]);
    expect(numeros.map((n) => [n.accionId, n.no_accion])).toEqual([
      ['a1', '2026-24-311-1'],
      ['a2', '2026-24-311-2'],
      ['a3', '2026-24-312-3'],
    ]);
  });

  it('usa la posición del hallazgo en el informe cuando no tiene no_hallazgo', () => {
    const numeros = generarNumerosAccion(
      '2026',
      24,
      [{ _id: 'h1', no_hallazgo: '1.1' }, { _id: 'h2', no_hallazgo: '  ' }, { _id: 'h3' }],
      [{ _id: 'a1', hallazgo_id: 'h3' }, { _id: 'a2', hallazgo_id: 'h2' }],
    );
    expect(numeros.map((n) => n.no_accion)).toEqual(['2026-24-2-1', '2026-24-3-2']);
  });

  it('falla si una acción apunta a un hallazgo que no está en el informe', () => {
    expect(() =>
      generarNumerosAccion('2026', 24, hallazgos, [{ _id: 'a9', hallazgo_id: 'hx' }]),
    ).toThrow('a9');
  });

  it('devuelve lista vacía si el plan no tiene acciones', () => {
    expect(generarNumerosAccion('2026', 24, hallazgos, [])).toEqual([]);
  });
});
