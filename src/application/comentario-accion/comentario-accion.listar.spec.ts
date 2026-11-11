import { BadRequestException, NotFoundException } from '@nestjs/common';
import { environment } from 'src/config/configuration';
import {
  ACCION_ID,
  DEP_LIDER,
  crearComentario,
  crearEscenario,
} from '../../../test/fixtures/comentario-accion';

describe('ComentarioAccionService.listar', () => {
  it('devuelve Data vacía (200) si la acción no tiene comentarios', async () => {
    const { service } = await crearEscenario({ comentarios: [] });

    const r = await service.listar(ACCION_ID, {});

    expect(r.Status).toBe(200);
    expect(r.Data).toEqual([]);
    expect(r.MetaData).toEqual({ Count: 0, puede_comentar: false });
  });

  it('consulta el CRUD con la acción, orden descendente y paginación por defecto', async () => {
    const { service, crud } = await crearEscenario();

    await service.listar(ACCION_ID, {});

    expect(crud.traerDataCrud).toHaveBeenCalledWith('comentario-accion', null, {
      query: `accion_mejora_id:${ACCION_ID},activo:true`,
      sortby: 'fecha_creacion',
      order: 'desc',
      limit: environment.FORO_ACCION.LIMITE_POR_DEFECTO,
      offset: 0,
    });
  });

  it('pasa limit y offset y devuelve el total del CRUD en MetaData.Count', async () => {
    const { service, crud } = await crearEscenario({
      comentarios: [crearComentario()],
      count: 45,
    });

    const r = await service.listar(ACCION_ID, { limit: '20', offset: '40' });

    expect(crud.traerDataCrud).toHaveBeenCalledWith(
      'comentario-accion',
      null,
      expect.objectContaining({ limit: 20, offset: 40 }),
    );
    expect(r.MetaData.Count).toBe(45);
  });

  it('agrega nombre del autor, etiqueta del rol y dependencia', async () => {
    const { service } = await crearEscenario({
      comentarios: [
        crearComentario(),
        crearComentario({
          _id: 'c2',
          usuario_id: 202,
          usuario_rol: 'JEFE_DEPENDENCIA',
          dependencia_id: DEP_LIDER,
        }),
      ],
      terceros: { 101: 'MARIA CAMARGO', 202: 'luis pérez' },
    });

    const r = await service.listar(ACCION_ID, {});

    expect(r.Data[0]).toEqual(
      expect.objectContaining({
        usuario_nombre: 'Maria Camargo',
        rol_nombre: 'Auditor',
        dependencia_id: null,
        dependencia_nombre: null,
      }),
    );
    expect(r.Data[1]).toEqual(
      expect.objectContaining({
        usuario_nombre: 'Luis Pérez',
        rol_nombre: 'Jefe Auditado',
        dependencia_id: DEP_LIDER,
        dependencia_nombre: 'Oficina de Contratación',
      }),
    );
  });

  it('consulta cada autor una sola vez aunque tenga varios comentarios', async () => {
    const { service, terceros } = await crearEscenario({
      comentarios: [
        crearComentario({ _id: 'a' }),
        crearComentario({ _id: 'b' }),
      ],
    });

    await service.listar(ACCION_ID, {});

    expect(terceros.getTerceroById).toHaveBeenCalledTimes(1);
  });

  it('muestra "Usuario <id>" si Terceros falla, sin romper la lista', async () => {
    const { service } = await crearEscenario({
      comentarios: [crearComentario({ usuario_id: 303 })],
      terceroFalla: [303],
    });

    const r = await service.listar(ACCION_ID, {});

    expect(r.Data[0].usuario_nombre).toBe('Usuario 303');
  });

  it('calcula puede_comentar con persona_id y rol', async () => {
    const { service } = await crearEscenario({ comentarios: [] });

    const oci = await service.listar(ACCION_ID, {
      persona_id: '7',
      rol: 'AUDITOR',
    });
    const admin = await service.listar(ACCION_ID, {
      persona_id: '7',
      rol: 'ADMIN_SISIFO',
    });

    expect(oci.MetaData.puede_comentar).toBe(true);
    expect(admin.MetaData.puede_comentar).toBe(false);
  });

  it('responde 404 si la acción no existe o está inactiva', async () => {
    const { service } = await crearEscenario({ accion: null });

    await expect(service.listar(ACCION_ID, {})).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it.each([
    ['id de acción inválido', 'no-es-objectid', {}],
    ['limit mayor al máximo', ACCION_ID, { limit: '500' }],
    ['limit cero', ACCION_ID, { limit: '0' }],
    ['offset negativo', ACCION_ID, { offset: '-1' }],
  ])('responde 400 con %s', async (_caso, id, query) => {
    const { service } = await crearEscenario();

    await expect(service.listar(id, query)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
