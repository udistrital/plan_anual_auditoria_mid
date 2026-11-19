import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { environment } from 'src/config/configuration';
import {
  AUDITORIA_EXTERNA_ID,
  FUENTE_ID,
  crearAuditoriaGuardada,
  crearCuerpoRegistro,
  crearEscenario,
} from '../../../test/fixtures/auditoria-externa';

async function errorDe(promesa: Promise<unknown>): Promise<any> {
  try {
    await promesa;
  } catch (error) {
    return error;
  }
  throw new Error('Se esperaba un error y no ocurrió');
}

describe('AuditoriaExternaService.registrar', () => {
  it('guarda todo en orden y devuelve los ids de la auditoría y del plan (201)', async () => {
    const { service, crud } = await crearEscenario();

    const r = await service.registrar(crearCuerpoRegistro());

    expect(r.Status).toBe(HttpStatus.CREATED);
    expect(r.Data).toEqual({
      auditoria_externa_id: 'id-auditoria-externa',
      plan_mejoramiento_id: 'id-plan-mejoramiento',
    });
    expect(crud.post.mock.calls.map((c) => c[0])).toEqual([
      'auditoria-externa',
      'auditoria-externa-estado',
      'auditoria-externa-hallazgo/lote',
      'documento',
      'plan-mejoramiento',
      'plan-mejoramiento-estado',
      'plan-mejoramiento-auditor',
    ]);
    expect(crud.delete).not.toHaveBeenCalled();
  });

  it('une las dependencias sin repetir y deja la externa en el estado Registrada', async () => {
    const { service, crud } = await crearEscenario();

    await service.registrar(crearCuerpoRegistro());

    const auditoria = crud.post.mock.calls[0][1] as any;
    expect(auditoria.dependencia_id).toEqual([32, 45]);
    expect(auditoria.estado_id).toBe(
      environment.ESTADO_AUDITORIA_EXTERNA.REGISTRADA,
    );
    expect(auditoria.fecha_informe_final).toBe('2026-03-10T00:00:00.000Z');
    const lote = crud.post.mock.calls[2][1] as any;
    expect(lote.auditoria_externa_id).toBe('id-auditoria-externa');
    expect(lote.hallazgos).toEqual([
      {
        vigencia_id: 2025,
        codigo_auditoria: 'PAD-2025-01',
        numeral: '3.1.1.1',
        descripcion: 'Deficiencias en la supervisión de contratos',
        dependencia_id: [32],
      },
      expect.objectContaining({ numeral: '3.1.1.2', dependencia_id: [32, 45] }),
    ]);
  });

  it('guarda el informe como documento de la externa con el tipo de informe final', async () => {
    const { service, crud } = await crearEscenario();

    await service.registrar(crearCuerpoRegistro());

    expect(crud.post).toHaveBeenCalledWith(
      'documento',
      expect.objectContaining({
        referencia_id: 'id-auditoria-externa',
        referencia_tipo: 'Auditoria Externa',
        nuxeo_id: 1234,
        tipo_id: environment.DOCUMENTO.TIPO_INFORME_FINAL,
        activo: true,
      }),
    );
  });

  it('crea el esqueleto del plan en 7081 con la fuente externa y asigna al auditor como líder', async () => {
    const { service, crud } = await crearEscenario();

    await service.registrar(crearCuerpoRegistro());

    expect(crud.post).toHaveBeenCalledWith(
      'plan-mejoramiento',
      expect.objectContaining({
        auditoria_externa_id: 'id-auditoria-externa',
        estado_id: environment.PLAN_MEJORAMIENTO_ESTADO.SIN_PLAN_MEJORAMIENTO,
        fuente: FUENTE_ID,
        tipo_evaluacion_id: environment.TIPO_EVALUACION.AUDITORIA_EXTERNA,
        vigencia_id: 2025,
      }),
    );
    const plan = crud.post.mock.calls[4][1] as any;
    expect(plan.auditoria_id).toBeUndefined();
    expect(crud.post).toHaveBeenCalledWith(
      'plan-mejoramiento-estado',
      expect.objectContaining({
        plan_mejoramiento_id: 'id-plan-mejoramiento',
        usuario_id: 101,
        usuario_rol: 'AUDITOR',
        fase_id: 'PLAN DE MEJORAMIENTO',
      }),
    );
    expect(crud.post).toHaveBeenCalledWith('plan-mejoramiento-auditor', {
      plan_mejoramiento_id: 'id-plan-mejoramiento',
      auditor_id: 101,
      asignado: true,
      asignado_por_id: 101,
      auditor_lider: true,
      activo: true,
    });
  });

  it.each(environment.AUDITORIA_EXTERNA.ROLES_REGISTRO)(
    'permite registrar al rol %s',
    async (rol) => {
      const { service } = await crearEscenario();

      const r = await service.registrar(
        crearCuerpoRegistro({ usuario_rol: rol }),
      );

      expect(r.Status).toBe(HttpStatus.CREATED);
    },
  );

  it.each(['JEFE_DEPENDENCIA', 'AUDITOR_ASISTENTE', 'toString', ''])(
    'rechaza con 403 al rol "%s" sin escribir nada',
    async (rol) => {
      const { service, crud } = await crearEscenario();

      const error = await errorDe(
        service.registrar(crearCuerpoRegistro({ usuario_rol: rol })),
      );

      expect(error).toBeInstanceOf(ForbiddenException);
      expect(crud.post).not.toHaveBeenCalled();
    },
  );

  describe('validación (400, sin escribir nada)', () => {
    it('reporta todos los errores de datos generales a la vez', async () => {
      const { service, crud } = await crearEscenario();

      const error = await errorDe(
        service.registrar(
          crearCuerpoRegistro({
            codigo_entidad: '',
            nombre_entidad: '  ',
            nombre_auditoria: '',
            fecha_informe_final: 'no es fecha',
            vigencia_id: 1999,
            usuario_id: 0,
            documento: {},
          }),
        ),
      );

      expect(error).toBeInstanceOf(BadRequestException);
      const campos = error.getResponse().errores.map((e: any) => e.campo);
      expect(campos).toEqual(
        expect.arrayContaining([
          'codigo_entidad',
          'nombre_entidad',
          'nombre_auditoria',
          'fecha_informe_final',
          'vigencia_id',
          'usuario_id',
          'documento',
        ]),
      );
      expect(crud.post).not.toHaveBeenCalled();
    });

    it('exige el PDF (nuxeo_id y enlace)', async () => {
      const { service } = await crearEscenario();

      const error = await errorDe(
        service.registrar(crearCuerpoRegistro({ documento: undefined })),
      );

      expect(error.getResponse().errores).toEqual([
        expect.objectContaining({ campo: 'documento' }),
      ]);
    });

    it('exige al menos un hallazgo', async () => {
      const { service, crud } = await crearEscenario();

      const error = await errorDe(
        service.registrar(crearCuerpoRegistro({ hallazgos: [] })),
      );

      expect(error.getResponse().errores).toEqual([
        expect.objectContaining({ campo: 'hallazgos' }),
      ]);
      expect(crud.post).not.toHaveBeenCalled();
    });

    it('rechaza un número de hallazgo repetido dentro del mismo código de auditoría', async () => {
      const { service, crud } = await crearEscenario();
      const cuerpo = crearCuerpoRegistro();
      cuerpo.hallazgos[1].numeral = cuerpo.hallazgos[0].numeral;

      const error = await errorDe(service.registrar(cuerpo));

      expect(error.getResponse().errores).toEqual([
        expect.objectContaining({ fila: 2, campo: 'numeral' }),
      ]);
      expect(crud.post).not.toHaveBeenCalled();
    });

    it('rechaza una dependencia inexistente en un hallazgo', async () => {
      const { service } = await crearEscenario();
      const cuerpo = crearCuerpoRegistro();
      cuerpo.hallazgos[0].dependencia_id = [9999];

      const error = await errorDe(service.registrar(cuerpo));

      expect(error.getResponse().errores).toEqual([
        expect.objectContaining({ fila: 1, campo: 'dependencia_id' }),
      ]);
    });

    it('rechaza un código de entidad con caracteres que rompen el filtro', async () => {
      const { service } = await crearEscenario();

      const error = await errorDe(
        service.registrar(crearCuerpoRegistro({ codigo_entidad: 'CB,001' })),
      );

      expect(error.getResponse().errores).toEqual([
        expect.objectContaining({ campo: 'codigo_entidad' }),
      ]);
    });
  });

  describe('duplicados (409)', () => {
    it('rechaza una auditoría del mismo ente, nombre y fecha de informe', async () => {
      const { service, crud } = await crearEscenario({
        existentes: [crearAuditoriaGuardada()],
      });

      const error = await errorDe(service.registrar(crearCuerpoRegistro()));

      expect(error).toBeInstanceOf(ConflictException);
      expect(crud.post).not.toHaveBeenCalled();
    });

    it('compara el nombre sin tildes, mayúsculas ni espacios repetidos', async () => {
      const { service } = await crearEscenario({
        existentes: [
          crearAuditoriaGuardada({
            nombre_auditoria: 'AUDITORIA  de regularidad pad 2025',
          }),
        ],
      });

      await expect(
        service.registrar(crearCuerpoRegistro()),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('permite el mismo nombre con otra fecha de informe', async () => {
      const { service } = await crearEscenario({
        existentes: [
          crearAuditoriaGuardada({
            fecha_informe_final: '2025-03-10T00:00:00.000Z',
          }),
        ],
      });

      const r = await service.registrar(crearCuerpoRegistro());

      expect(r.Status).toBe(HttpStatus.CREATED);
    });
  });

  describe('fuente del plan', () => {
    it('falla con 502 y sin escribir si no existe el parámetro F_AUD_EXT', async () => {
      const { service, crud } = await crearEscenario({ fuente: null });

      const error = await errorDe(service.registrar(crearCuerpoRegistro()));

      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(HttpStatus.BAD_GATEWAY);
      expect(crud.post).not.toHaveBeenCalled();
    });

    it('resuelve la fuente por código de abreviación, no por id fijo', async () => {
      const { service, parametros } = await crearEscenario();

      await service.registrar(crearCuerpoRegistro());

      expect(parametros.get).toHaveBeenCalledWith(
        'parametro',
        null,
        expect.objectContaining({
          query: expect.stringContaining('CodigoAbreviacion:F_AUD_EXT'),
        }),
      );
    });
  });

  describe('compensación si falla un paso intermedio', () => {
    it('si falla el plan, revierte en orden inverso lo creado y responde 502', async () => {
      const { service, crud } = await crearEscenario({
        falla: 'plan-mejoramiento',
      });

      const error = await errorDe(service.registrar(crearCuerpoRegistro()));

      expect(error.getStatus()).toBe(HttpStatus.BAD_GATEWAY);
      expect(error.message).toContain('No se guardó nada');
      const borrados = crud.delete.mock.calls.map((c) => c[0]);
      expect(borrados.slice(0, 3)).toEqual([
        'documento',
        'auditoria-externa-estado',
        'auditoria-externa',
      ]);
      // y los hallazgos que el lote ya hubiera creado
      expect(
        borrados.filter((e) => e === 'auditoria-externa-hallazgo'),
      ).toHaveLength(2);
    });

    it('si falla el lote de hallazgos, revierte la auditoría y busca los hallazgos creados', async () => {
      const { service, crud } = await crearEscenario({
        falla: 'auditoria-externa-hallazgo/lote',
      });

      await errorDe(service.registrar(crearCuerpoRegistro()));

      expect(crud.delete).toHaveBeenCalledWith(
        'auditoria-externa',
        'id-auditoria-externa',
      );
      expect(crud.traerDataCrud).toHaveBeenCalledWith(
        'auditoria-externa-hallazgo',
        null,
        expect.objectContaining({
          query: `auditoria_externa_id:id-auditoria-externa,activo:true`,
        }),
      );
      expect(crud.post).not.toHaveBeenCalledWith(
        'documento',
        expect.anything(),
      );
    });

    it('si falla la creación de la auditoría, no hay nada que revertir', async () => {
      const { service, crud } = await crearEscenario({
        falla: 'auditoria-externa',
      });

      const error = await errorDe(service.registrar(crearCuerpoRegistro()));

      expect(error.getStatus()).toBe(HttpStatus.BAD_GATEWAY);
      expect(crud.delete).not.toHaveBeenCalled();
    });

    it('si un paso de la reversa falla, sigue con los demás', async () => {
      const { service, crud } = await crearEscenario({
        falla: 'plan-mejoramiento',
      });
      crud.delete.mockRejectedValueOnce(new Error('no se pudo borrar'));

      const error = await errorDe(service.registrar(crearCuerpoRegistro()));

      expect(error.getStatus()).toBe(HttpStatus.BAD_GATEWAY);
      expect(crud.delete).toHaveBeenCalledWith(
        'auditoria-externa',
        'id-auditoria-externa',
      );
    });

    it('no expone el detalle del CRUD al cliente', async () => {
      const { service } = await crearEscenario({ falla: 'documento' });

      const error = await errorDe(service.registrar(crearCuerpoRegistro()));

      expect(error.message).not.toContain('CRUD caído');
    });
  });

  it('no escribe nada si la auditoría ya existía: dos envíos seguidos, solo el primero guarda', async () => {
    const primero = await crearEscenario();
    await primero.service.registrar(crearCuerpoRegistro());
    const segundo = await crearEscenario({
      existentes: [crearAuditoriaGuardada()],
    });

    await expect(
      segundo.service.registrar(crearCuerpoRegistro()),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(segundo.crud.post).not.toHaveBeenCalled();
    expect(AUDITORIA_EXTERNA_ID).toBeDefined();
  });
});
