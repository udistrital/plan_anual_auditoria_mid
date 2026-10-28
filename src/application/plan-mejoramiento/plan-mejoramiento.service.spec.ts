import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { of } from 'rxjs';
import { PlanMejoramientoService } from './plan-mejoramiento.service';
import { AuditoriaCrudService } from 'src/shared/services/auditoria-crud.service';
import { DominiosService } from 'src/shared/utils/dominios/dominios.service';
import { environment } from 'src/config/configuration';

const ESTADO = environment.PLAN_MEJORAMIENTO_ESTADO;

describe('PlanMejoramientoService', () => {
  let service: PlanMejoramientoService;
  let crud: { traerDataCrud: jest.Mock; put: jest.Mock; post: jest.Mock };
  let planes: Record<string, any>;
  let acciones: Record<string, any[]>;

  const hallazgos = [
    { _id: 'h1', no_hallazgo: '3.1.1' },
    { _id: 'h2', no_hallazgo: '3.1.2' },
  ];

  beforeEach(async () => {
    planes = {
      p1: { _id: 'p1', auditoria_id: 'au1', estado_id: ESTADO.REVISION_PLAN_MEJORAMIENTO_AUDITOR },
    };
    acciones = {
      p1: [
        { _id: 'a2', hallazgo_id: 'h2' },
        { _id: 'a1', hallazgo_id: { _id: 'h1' } },
      ],
    };

    crud = {
      traerDataCrud: jest.fn(async (endpoint: string, id: string | null, params?: any) => {
        switch (endpoint) {
          case 'plan-mejoramiento':
            return id ? { Data: planes[id] ?? null } : { Data: Object.values(planes) };
          case 'auditoria':
            return { Data: { _id: id, consecutivo_no_auditoria: 24, vigencia_id: 10 } };
          case 'informe':
            return { Data: [{ _id: 'inf1' }] };
          case 'hallazgo':
            return { Data: hallazgos };
          case 'accion-mejora': {
            const planId = /plan_mejoramiento_id:(\w+)/.exec(params.query)![1];
            return { Data: acciones[planId] ?? [] };
          }
        }
      }),
      put: jest.fn().mockResolvedValue({ Success: true }),
      post: jest.fn().mockResolvedValue({ Success: true, Data: { _id: 'e1' } }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlanMejoramientoService,
        { provide: AuditoriaCrudService, useValue: crud },
        {
          provide: DominiosService,
          useValue: {
            getParametros: jest.fn(() => of({ parametros: [{ Id: 10, Nombre: '2026' }] })),
          },
        },
      ],
    }).compile();

    service = module.get(PlanMejoramientoService);
  });

  describe('aprobar', () => {
    it('numera las acciones y después registra el estado APROBADO', async () => {
      await service.aprobar('p1', { usuario_id: 5, usuario_rol: 'JEFE_CONTROL_INTERNO' });

      expect(crud.put.mock.calls).toEqual([
        ['accion-mejora', 'a1', { no_accion: '2026-24-311-1' }],
        ['accion-mejora', 'a2', { no_accion: '2026-24-312-2' }],
      ]);
      expect(crud.post).toHaveBeenCalledWith('plan-mejoramiento-estado', {
        usuario_id: 5,
        usuario_rol: 'JEFE_CONTROL_INTERNO',
        plan_mejoramiento_id: 'p1',
        estado_id: ESTADO.APROBADO_PLAN_MEJORAMIENTO,
      });
      expect(crud.post.mock.invocationCallOrder[0]).toBeGreaterThan(
        crud.put.mock.invocationCallOrder[1],
      );
    });

    it('rechaza un plan que no está en revisión del auditor', async () => {
      planes.p1.estado_id = ESTADO.APROBADO_PLAN_MEJORAMIENTO;
      await expect(service.aprobar('p1', {})).rejects.toBeInstanceOf(BadRequestException);
      expect(crud.put).not.toHaveBeenCalled();
      expect(crud.post).not.toHaveBeenCalled();
    });

    it('no aprueba el plan si falla el guardado de un número', async () => {
      crud.put.mockRejectedValueOnce(new Error('CRUD caído'));
      await expect(service.aprobar('p1', {})).rejects.toThrow('CRUD caído');
      expect(crud.post).not.toHaveBeenCalled();
    });

    it('no aprueba el plan si la vigencia no existe', async () => {
      crud.traerDataCrud.mockImplementationOnce(async () => ({ Data: planes.p1 }));
      crud.traerDataCrud.mockImplementationOnce(async () => ({ Data: acciones.p1 }));
      crud.traerDataCrud.mockImplementationOnce(async () => ({
        Data: { consecutivo_no_auditoria: 24, vigencia_id: 99 },
      }));
      await expect(service.aprobar('p1', {})).rejects.toBeInstanceOf(BadRequestException);
      expect(crud.post).not.toHaveBeenCalled();
    });
  });

  describe('numerarPlanAprobado', () => {
    beforeEach(() => {
      planes = {
        p1: { _id: 'p1', auditoria_id: 'au1', estado_id: ESTADO.APROBADO_PLAN_MEJORAMIENTO },
        p2: { _id: 'p2', auditoria_id: 'au2', estado_id: ESTADO.FIN_PLAN_MEJORAMIENTO },
        p3: { _id: 'p3', auditoria_id: 'au3', estado_id: ESTADO.APROBADO_PLAN_MEJORAMIENTO },
        p4: { _id: 'p4', auditoria_id: 'au4', estado_id: ESTADO.APROBADO_PLAN_MEJORAMIENTO },
        p5: { _id: 'p5', auditoria_id: 'au5', estado_id: ESTADO.CREANDO_PLAN_MEJORAMIENTO },
      };
      acciones = {
        p1: [{ _id: 'a2', hallazgo_id: 'h2' }, { _id: 'a1', hallazgo_id: 'h1' }],
        p2: [{ _id: 'b1', hallazgo_id: 'h1', no_accion: '2026-24-311-1' }],
        p3: [
          { _id: 'c1', hallazgo_id: 'h1', no_accion: '2026-24-311-1' },
          { _id: 'c2', hallazgo_id: 'h2' },
        ],
        p4: [],
        p5: [{ _id: 'd1', hallazgo_id: 'h1' }],
      };
    });

    it('numera solo las acciones del plan indicado sin cambiar su estado', async () => {
      const resumen = await service.numerarPlanAprobado('p1');

      expect(resumen).toEqual({
        plan_mejoramiento_id: 'p1',
        ya_numerado: false,
        acciones: [
          { accionId: 'a1', no_accion: '2026-24-311-1' },
          { accionId: 'a2', no_accion: '2026-24-312-2' },
        ],
      });
      expect(crud.put.mock.calls.map((c) => c[1])).toEqual(['a1', 'a2']);
      expect(crud.post).not.toHaveBeenCalled();
    });

    it('no escribe nada si el plan ya está numerado', async () => {
      const resumen = await service.numerarPlanAprobado('p2');

      expect(resumen.ya_numerado).toBe(true);
      expect(resumen.acciones).toEqual([{ accionId: 'b1', no_accion: '2026-24-311-1' }]);
      expect(crud.put).not.toHaveBeenCalled();
    });

    it.each([
      ['con numeración parcial', 'p3'],
      ['sin acciones', 'p4'],
      ['que no está aprobado', 'p5'],
    ])('rechaza un plan %s', async (_caso, planId) => {
      await expect(service.numerarPlanAprobado(planId)).rejects.toBeInstanceOf(BadRequestException);
      expect(crud.put).not.toHaveBeenCalled();
    });
  });
});
