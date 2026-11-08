import { PlantillaPlanMejoramientoService } from './plantilla-plan-mejoramiento.service';

describe('PlantillaPlanMejoramientoService - columna "Descripción del Hallazgo"', () => {
  const hallazgos = [
    {
      _id: 'h1',
      titulo: 'Título del hallazgo',
      descripcion: 'NuxeoEnlace:uuid-1',
      criterio: 'Causa',
    },
  ];
  const acciones = [
    { _id: 'a1', hallazgo_id: 'h1' },
    { _id: 'a2', hallazgo_id: 'h1' },
  ];
  const auditoriaCrudService = {
    traerDataCrud: jest.fn((endpoint: string) =>
      Promise.resolve({
        Data:
          endpoint === 'hallazgo'
            ? hallazgos
            : endpoint === 'accion-mejora'
              ? acciones
              : [],
      }),
    ),
  };
  const service = new PlantillaPlanMejoramientoService(
    {} as any,
    auditoriaCrudService as any,
    {} as any,
    {} as any,
    { getDependencia: jest.fn() } as any,
    jest.fn(() => ({ format: () => '' })) as any,
  );

  it('muestra el título en cada fila, no la descripción', async () => {
    const filas = await service['obtenerFilasAcciones'](
      'auditoria-1',
      'plan-1',
    );

    expect(filas.map((f) => f.descripcion)).toEqual([
      'Título del hallazgo',
      'Título del hallazgo',
    ]);
  });
});
