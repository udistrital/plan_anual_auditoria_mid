import { esHtml, esHtmlVacio, textoPlanoAHtml } from './html.util';

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

describe('esHtml', () => {
  it('reconoce el HTML de Quill y no el texto plano', () => {
    expect(esHtml('<p>Texto</p>')).toBe(true);
    expect(esHtml('<ol><li>Uno</li></ol>')).toBe(true);
    expect(esHtml('El valor <p> va al final')).toBe(false);
    expect(esHtml(null)).toBe(false);
  });
});

describe('textoPlanoAHtml', () => {
  it('conserva los saltos de línea y escapa el HTML', () => {
    expect(textoPlanoAHtml('Uno\n\na < b')).toBe(
      '<p>Uno</p><p><br></p><p>a &lt; b</p>',
    );
    expect(textoPlanoAHtml('  ')).toBe('');
  });
});
