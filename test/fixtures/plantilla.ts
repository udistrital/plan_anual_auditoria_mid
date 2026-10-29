// Datos de prueba del módulo plantilla (flujo de texto enriquecido en Nuxeo)

export const crearTema = (overrides: Record<string, any> = {}) => ({
  _id: 'tema-1',
  titulo: 'Tema evaluado',
  descripcion_titulo: 'Descripción en texto plano',
  ...overrides,
});

export const enlaceNuxeo = (uuid: string) => `NuxeoEnlace:${uuid}`;

// El gestor documental devuelve el HTML del texto enriquecido codificado en base64
export const contenidoNuxeoBase64 = (html: string) =>
  Buffer.from(html, 'utf-8').toString('base64');

export const respuestaNuxeo = (file?: string) => ({
  data: file === undefined ? {} : { file },
});

export const htmlConImagen =
  '<p class="ql-align-center">Evaluación del área de contratación</p>' +
  '<p><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" width="500"></p>';
