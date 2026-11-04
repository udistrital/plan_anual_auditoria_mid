import {
  decodificarHtmlBase64,
  esEnlaceNuxeo,
  resolverDescripcionesTemas,
  uuidDeEnlace,
} from './descripcion-nuxeo.util';
import {
  contenidoNuxeoBase64,
  crearTema,
  enlaceNuxeo,
  htmlConImagen,
} from '../../../test/fixtures/plantilla';

describe('descripcion-nuxeo.util', () => {
  const obtener = jest.fn((uuid: string) =>
    Promise.resolve(contenidoNuxeoBase64(`<p>Contenido ${uuid}</p>`)),
  );

  afterEach(() => jest.clearAllMocks());

  it('reconoce el enlace de Nuxeo y extrae su uuid', () => {
    expect(esEnlaceNuxeo(enlaceNuxeo('uuid-1'))).toBe(true);
    expect(esEnlaceNuxeo('<p>Texto</p>')).toBe(false);
    expect(esEnlaceNuxeo(null)).toBe(false);
    expect(
      uuidDeEnlace(enlaceNuxeo('c892f121-905b-4342-8201-2f525bea6f38')),
    ).toBe('c892f121-905b-4342-8201-2f525bea6f38');
  });

  it('decodifica el HTML del gestor conservando tildes e imágenes', () => {
    expect(decodificarHtmlBase64(contenidoNuxeoBase64(htmlConImagen))).toBe(
      htmlConImagen,
    );
    expect(decodificarHtmlBase64('')).toBe('');
  });

  it('resuelve la descripción de los subtemas además de la del tema, sin tocar los demás campos', async () => {
    const tema: any = crearTema({
      descripcion_titulo: enlaceNuxeo('uuid-tema'),
      subtema: [
        {
          _id: 'sub-1',
          titulo: 'Subtema con imagen',
          descripcion_titulo: enlaceNuxeo('uuid-sub'),
        },
        {
          _id: 'sub-2',
          titulo: 'Subtema en texto',
          descripcion_titulo: '<p>Texto</p>',
        },
        { _id: 'sub-3', titulo: 'Subtema sin descripción' },
      ],
    });

    const [resultado] = await resolverDescripcionesTemas<any>([tema], obtener);

    expect(resultado.descripcion_titulo).toBe('<p>Contenido uuid-tema</p>');
    expect(resultado.subtema.map((s: any) => s.descripcion_titulo)).toEqual([
      '<p>Contenido uuid-sub</p>',
      '<p>Texto</p>',
      undefined,
    ]);
    expect(resultado.subtema[1]).toBe(tema.subtema[1]);
    expect(tema.descripcion_titulo).toBe(enlaceNuxeo('uuid-tema'));
  });

  it('si el gestor no entrega el documento, deja la descripción vacía y sigue con los demás temas', async () => {
    obtener.mockImplementationOnce(() => Promise.resolve(''));
    const temas = [
      crearTema({
        _id: 'tema-1',
        descripcion_titulo: enlaceNuxeo('uuid-caido'),
      }),
      crearTema({ _id: 'tema-2', descripcion_titulo: enlaceNuxeo('uuid-2') }),
    ];

    const resultado = await resolverDescripcionesTemas(temas, obtener);

    expect(resultado.map((t) => t.descripcion_titulo)).toEqual([
      '',
      '<p>Contenido uuid-2</p>',
    ]);
  });

  it('no consulta el gestor cuando no hay enlaces y acepta una lista vacía', async () => {
    const temas = [
      crearTema({ subtema: [{ _id: 'sub-1', titulo: 'Sin enlace' }] }),
    ];

    expect(await resolverDescripcionesTemas(temas, obtener)).toEqual(temas);
    expect(await resolverDescripcionesTemas([], obtener)).toEqual([]);
    expect(obtener).not.toHaveBeenCalled();
  });
});
