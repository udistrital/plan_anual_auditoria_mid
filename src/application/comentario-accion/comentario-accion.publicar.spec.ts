import {
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { environment } from 'src/config/configuration';
import {
  ACCION_ID,
  DEP_AJENA,
  DEP_APOYO,
  DEP_LIDER,
  crearEscenario,
} from '../../../test/fixtures/comentario-accion';

const cuerpo = (cambios: Record<string, any> = {}) => ({
  mensaje: '  Se cargarán las firmas en el próximo corte.  ',
  usuario_id: 101,
  usuario_rol: 'AUDITOR',
  ...cambios,
});

describe('ComentarioAccionService.publicar', () => {
  it.each(environment.FORO_ACCION.ROLES_CONTROL_INTERNO)(
    'el rol de Control Interno %s comenta aunque no esté asignado al plan (201)',
    async (rol) => {
      const { service, crud } = await crearEscenario();

      const r = await service.publicar(ACCION_ID, cuerpo({ usuario_rol: rol }));

      expect(r.Status).toBe(HttpStatus.CREATED);
      expect(crud.post).toHaveBeenCalledWith('comentario-accion', {
        accion_mejora_id: ACCION_ID,
        mensaje: 'Se cargarán las firmas en el próximo corte.',
        usuario_id: 101,
        usuario_rol: rol,
      });
    },
  );

  it('la dependencia líder comenta y queda su dependencia_id', async () => {
    const { service, crud, terceros } = await crearEscenario({
      dependenciasPersona: [DEP_LIDER],
    });

    const r = await service.publicar(
      ACCION_ID,
      cuerpo({ usuario_id: 202, usuario_rol: 'JEFE_DEPENDENCIA' }),
    );

    expect(terceros.getDependenciasByPersona).toHaveBeenCalledWith(
      202,
      environment.CARGO.JEFE_DEPENDENCIA_ID,
    );
    expect(crud.post).toHaveBeenCalledWith(
      'comentario-accion',
      expect.objectContaining({ dependencia_id: DEP_LIDER }),
    );
    expect(r.Data.dependencia_nombre).toBe('Oficina de Contratación');
  });

  it('la dependencia de apoyo comenta con el cargo de asistente', async () => {
    const { service, crud, terceros } = await crearEscenario({
      dependenciasPersona: [DEP_APOYO],
    });

    await service.publicar(
      ACCION_ID,
      cuerpo({ usuario_id: 203, usuario_rol: 'ASISTENTE_DEPENDENCIA' }),
    );

    expect(terceros.getDependenciasByPersona).toHaveBeenCalledWith(
      203,
      environment.CARGO.ASISTENTE_DEPENDENCIA_ID,
    );
    expect(crud.post).toHaveBeenCalledWith(
      'comentario-accion',
      expect.objectContaining({ dependencia_id: DEP_APOYO }),
    );
  });

  it('si la persona es de la líder y de apoyo, se guarda la líder', async () => {
    const { service, crud } = await crearEscenario({
      dependenciasPersona: [DEP_APOYO, DEP_LIDER],
    });

    await service.publicar(
      ACCION_ID,
      cuerpo({ usuario_rol: 'JEFE_DEPENDENCIA' }),
    );

    expect(crud.post).toHaveBeenCalledWith(
      'comentario-accion',
      expect.objectContaining({ dependencia_id: DEP_LIDER }),
    );
  });

  it('una dependencia que no es responsable recibe 403 y no se escribe nada', async () => {
    const { service, crud } = await crearEscenario({
      dependenciasPersona: [DEP_AJENA],
    });

    await expect(
      service.publicar(ACCION_ID, cuerpo({ usuario_rol: 'JEFE_DEPENDENCIA' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(crud.post).not.toHaveBeenCalled();
  });

  it('el administrador solo lee (403)', async () => {
    const { service, crud } = await crearEscenario();

    await expect(
      service.publicar(ACCION_ID, cuerpo({ usuario_rol: 'ADMIN_SISIFO' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(crud.post).not.toHaveBeenCalled();
  });

  it.each([
    ['mensaje vacío', cuerpo({ mensaje: '   ' })],
    [
      'mensaje de más de 1000 caracteres',
      cuerpo({ mensaje: 'x'.repeat(1001) }),
    ],
    ['usuario_id no numérico', cuerpo({ usuario_id: 'abc' })],
    ['rol desconocido', cuerpo({ usuario_rol: 'INVITADO' })],
    ['rol que es una clave heredada', cuerpo({ usuario_rol: 'toString' })],
  ])('responde 400 con %s', async (_caso, body) => {
    const { service, crud } = await crearEscenario();

    await expect(
      service.publicar(ACCION_ID, body as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(crud.post).not.toHaveBeenCalled();
  });

  it('acepta un mensaje de exactamente 1000 caracteres', async () => {
    const { service } = await crearEscenario();

    const r = await service.publicar(
      ACCION_ID,
      cuerpo({ mensaje: 'x'.repeat(1000) }),
    );

    expect(r.Status).toBe(HttpStatus.CREATED);
  });

  it('responde 404 si la acción no existe', async () => {
    const { service, crud } = await crearEscenario({ accion: null });

    await expect(service.publicar(ACCION_ID, cuerpo())).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(crud.post).not.toHaveBeenCalled();
  });

  it('responde 502 si el CRUD no registra el comentario', async () => {
    const { service, crud } = await crearEscenario();
    crud.post.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    await expect(service.publicar(ACCION_ID, cuerpo())).rejects.toMatchObject({
      status: HttpStatus.BAD_GATEWAY,
    });
  });

  it('devuelve el comentario creado con autor y rol resueltos', async () => {
    const { service } = await crearEscenario();

    const r = await service.publicar(ACCION_ID, cuerpo());

    expect(r.Data).toEqual(
      expect.objectContaining({
        _id: 'nuevo',
        usuario_nombre: 'Maria Camargo',
        rol_nombre: 'Auditor',
        mensaje: 'Se cargarán las firmas en el próximo corte.',
      }),
    );
  });
});
