import {
  decodificarHtmlBase64,
  DESCRIPCION_HALLAZGO_NO_DISPONIBLE,
  esEnlaceNuxeo,
  resolverDescripcionesHallazgos,
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
          descripcion: enlaceNuxeo('uuid-sub'),
        },
        {
          _id: 'sub-2',
          titulo: 'Subtema en texto',
          descripcion: '<p>Texto</p>',
        },
        { _id: 'sub-3', titulo: 'Subtema sin descripción' },
      ],
    });

    const [resultado] = await resolverDescripcionesTemas<any>([tema], obtener);

    expect(resultado.descripcion_titulo).toBe('<p>Contenido uuid-tema</p>');
    expect(resultado.subtema.map((s: any) => s.descripcion)).toEqual([
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

  describe('resolverDescripcionesHallazgos', () => {
    it('deja en HTML los tres formatos, en orden y sin modificar el original', async () => {
      const hallazgos = [
        { _id: 'h1', descripcion: 'Uno\nDos < 3' },
        { _id: 'h2', descripcion: '<p>Rico</p>' },
        { _id: 'h3', descripcion: enlaceNuxeo('uuid-1') },
      ];

      const resultado = await resolverDescripcionesHallazgos(
        hallazgos,
        obtener,
      );

      expect(resultado.map((h) => h.descripcion)).toEqual([
        '<p>Uno</p><p>Dos &lt; 3</p>',
        '<p>Rico</p>',
        '<p>Contenido uuid-1</p>',
      ]);
      expect(hallazgos[0].descripcion).toBe('Uno\nDos < 3');
      expect(obtener).toHaveBeenCalledTimes(1);
    });

    it('muestra un aviso visible si el gestor no entrega el documento', async () => {
      const [hallazgo] = await resolverDescripcionesHallazgos(
        [{ descripcion: enlaceNuxeo('caido') }],
        () => Promise.resolve(''),
      );

      expect(hallazgo.descripcion).toBe(DESCRIPCION_HALLAZGO_NO_DISPONIBLE);
    });

    it('deja vacío el HTML sin contenido y tolera una lista nula', async () => {
      const [hallazgo] = await resolverDescripcionesHallazgos(
        [{ descripcion: '<p><br></p>' }],
        obtener,
      );

      expect(hallazgo.descripcion).toBe('');
      await expect(
        resolverDescripcionesHallazgos(null as any, obtener),
      ).resolves.toEqual([]);
    });
  });
});
