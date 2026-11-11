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

// Plan de mejoramiento (formato de formulación): documentos como los devuelve el CRUD
export const crearHallazgoPlan = (overrides: Record<string, any> = {}) => ({
  _id: 'hallazgo-1',
  titulo: 'Inconsistencias en registros contables',
  descripcion: '<p>Descripción detallada del hallazgo</p>',
  criterio: 'Criterio evaluado en fase 3',
  ...overrides,
});

export const crearAccionPlan = (overrides: Record<string, any> = {}) => ({
  _id: 'accion-1',
  hallazgo_id: 'hallazgo-1',
  descripcion: 'Implementar conciliaciones mensuales',
  causa: 'Falta de seguimiento a los registros',
  tipo_id: 2,
  nombre_indicador: 'Conciliaciones realizadas',
  formula_indicador: 'Realizadas / Programadas',
  meta: '100%',
  ...overrides,
});

export const respuestaCrud = (data: any[]) => ({ Data: data });

export const htmlConImagen =
  '<p class="ql-align-center">Evaluación del área de contratación</p>' +
  '<p><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" width="500"></p>';
