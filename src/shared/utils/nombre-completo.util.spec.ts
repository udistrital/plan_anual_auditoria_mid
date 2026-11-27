import { construirNombreCompleto, nombreTercero } from './nombre-completo.util';

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

describe('nombreTercero', () => {
  it('usa el orden nombres-apellidos aunque NombreCompleto venga con apellidos primero', () => {
    expect(
      nombreTercero({
        NombreCompleto: 'NUNEZ SANCHEZ SERGIO DUVAN',
        PrimerNombre: 'SERGIO',
        SegundoNombre: 'DUVAN',
        PrimerApellido: 'NUÑEZ ',
        SegundoApellido: 'SANCHEZ',
      }),
    ).toBe('SERGIO DUVAN NUÑEZ SANCHEZ');
  });

  it('usa NombreCompleto (sin espacios sobrantes) si no hay componentes', () => {
    expect(nombreTercero({ NombreCompleto: '  PAZOS  ALVAREZ ALFONSO ' })).toBe(
      'PAZOS ALVAREZ ALFONSO',
    );
  });

  it('usa el respaldo si no hay componentes ni NombreCompleto', () => {
    expect(nombreTercero(null, 'Sin auditor asignado.')).toBe('Sin auditor asignado.');
    expect(nombreTercero({ NombreCompleto: '  ' }, 'Usuario')).toBe('Usuario');
    expect(nombreTercero(undefined)).toBe('');
  });
});
