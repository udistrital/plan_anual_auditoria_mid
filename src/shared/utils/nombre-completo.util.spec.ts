import { construirNombreCompleto } from './nombre-completo.util';

describe('construirNombreCompleto', () => {
  it('ordena primer nombre, segundo nombre, primer apellido y segundo apellido', () => {
    expect(
      construirNombreCompleto({
        PrimerNombre: 'Ana',
        SegundoNombre: 'María',
        PrimerApellido: 'Pérez',
        SegundoApellido: 'Gómez',
      }),
    ).toBe('Ana María Pérez Gómez');
  });

  it('no depende del orden de NombreCompleto', () => {
    expect(
      construirNombreCompleto({
        NombreCompleto: 'Pérez Gómez Ana María',
        PrimerNombre: 'Ana',
        SegundoNombre: 'María',
        PrimerApellido: 'Pérez',
        SegundoApellido: 'Gómez',
      } as any),
    ).toBe('Ana María Pérez Gómez');
  });

  it('omite componentes ausentes sin dejar espacios duplicados', () => {
    expect(
      construirNombreCompleto({
        PrimerNombre: 'Luis',
        PrimerApellido: 'Rojas',
      }),
    ).toBe('Luis Rojas');
  });

  it('descarta null, undefined, vacíos y solo espacios', () => {
    expect(
      construirNombreCompleto({
        PrimerNombre: '  Luis ',
        SegundoNombre: null,
        PrimerApellido: '   ',
        SegundoApellido: undefined,
      }),
    ).toBe('Luis');
    expect(
      construirNombreCompleto({
        PrimerNombre: '',
        SegundoNombre: 'Carlos',
        PrimerApellido: 'Díaz',
        SegundoApellido: '',
      }),
    ).toBe('Carlos Díaz');
  });

  it('no muestra "null" ni "undefined" y descarta valores que no son texto', () => {
    const nombre = construirNombreCompleto({
      PrimerNombre: 'Ana',
      SegundoNombre: 0,
      PrimerApellido: {},
      SegundoApellido: 'Ruiz',
    });
    expect(nombre).toBe('Ana Ruiz');
    expect(nombre).not.toMatch(/null|undefined/);
  });

  it('devuelve cadena vacía si todos los componentes están ausentes', () => {
    expect(construirNombreCompleto({})).toBe('');
    expect(
      construirNombreCompleto({
        PrimerNombre: ' ',
        SegundoNombre: null,
        PrimerApellido: undefined,
        SegundoApellido: '',
      }),
    ).toBe('');
    expect(construirNombreCompleto(null)).toBe('');
    expect(construirNombreCompleto(undefined)).toBe('');
  });
});
