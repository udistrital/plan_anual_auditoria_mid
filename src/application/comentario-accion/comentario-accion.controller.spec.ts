import { ComentarioAccionController } from './comentario-accion.controller';

describe('ComentarioAccionController (ruta plana /comentario-accion)', () => {
  const ACCION = '6a25babec5406015a57e555d';
  let service: { listar: jest.Mock; publicar: jest.Mock };
  let controller: ComentarioAccionController;

  beforeEach(() => {
    service = { listar: jest.fn(), publicar: jest.fn() };
    controller = new ComentarioAccionController(service as any);
  });

  it('GET toma accion_mejora_id de la query', async () => {
    const query = { accion_mejora_id: ACCION, limit: '5' };
    await controller.listar(query);
    expect(service.listar).toHaveBeenCalledWith(ACCION, query);
  });

  it('GET sin accion_mejora_id delega undefined (el service responde 400)', async () => {
    await controller.listar({});
    expect(service.listar).toHaveBeenCalledWith(undefined, {});
  });

  it('POST toma accion_mejora_id del body', async () => {
    const body = {
      accion_mejora_id: ACCION,
      mensaje: 'hola',
      usuario_id: 1,
      usuario_rol: 'JEFE_DEPENDENCIA',
    };
    await controller.publicar(body);
    expect(service.publicar).toHaveBeenCalledWith(ACCION, body);
  });

  it('usa la ruta plana y no la anidada', () => {
    expect(Reflect.getMetadata('path', ComentarioAccionController)).toBe(
      'comentario-accion',
    );
  });
});
