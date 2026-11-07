import { esHtmlVacio } from './html.util';

describe('esHtmlVacio', () => {
  it('considera vacíos null, undefined y cadena vacía', () => {
    expect(esHtmlVacio(null)).toBe(true);
    expect(esHtmlVacio(undefined)).toBe(true);
    expect(esHtmlVacio('')).toBe(true);
  });

  it('considera vacío el HTML de Quill sin texto', () => {
    expect(esHtmlVacio('<p><br></p>')).toBe(true);
    expect(esHtmlVacio('<p>&nbsp;</p><p>  </p>')).toBe(true);
  });

  it('detecta contenido de texto', () => {
    expect(esHtmlVacio('<p>Texto</p>')).toBe(false);
  });

  it('detecta imágenes aunque no haya texto', () => {
    expect(esHtmlVacio('<p><img src="x"></p>')).toBe(false);
  });

  it('no considera vacío un enlace de Nuxeo', () => {
    expect(esHtmlVacio('NuxeoEnlace:123')).toBe(false);
  });
});
