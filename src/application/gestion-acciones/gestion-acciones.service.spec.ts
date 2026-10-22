import { Test, TestingModule } from '@nestjs/testing';
import { of } from 'rxjs';
import {
  GestionAccionesService,
  clasificarAccion,
} from './gestion-acciones.service';
import { AuditoriaCrudService } from 'src/shared/services/auditoria-crud.service';
import { TercerosHelperService } from 'src/shared/services/terceros-helper.service';
import { DominiosService } from 'src/shared/utils/dominios/dominios.service';
import { environment } from 'src/config/configuration';

const { PLAN_MEJORAMIENTO_ESTADO: ESTADO } = environment;
const MS_POR_DIA = 86_400_000;

const inicioDelDia = (fecha: Date) => {
  const inicio = new Date(fecha);
  inicio.setHours(0, 0, 0, 0);
  return inicio;
};

/** Fecha ISO que queda a `dias` días exactos del inicio del día de `base`. */
const fechaEn = (dias: number, base: Date = new Date()) =>
  new Date(inicioDelDia(base).getTime() + dias * MS_POR_DIA).toISOString();

describe('clasificarAccion', () => {
  const hoy = new Date(2025, 5, 15, 12, 0, 0);
  const base = {
    en_revision: false,
    total_soportes: 0,
    calificacion: null as number | null,
    fecha_fin: null as string | null,
  };

  it('cargue habilitado → CARGUE_ABIERTO', () => {
    expect(clasificarAccion({ ...base, en_revision: true }, hoy).grupo).toBe(
      'CARGUE_ABIERTO',
    );
  });

  it('con calificación actual → CALIFICADAS', () => {
    expect(clasificarAccion({ ...base, calificacion: 50 }, hoy).grupo).toBe(
      'CALIFICADAS',
    );
  });

  it('cargue cerrado, sin calificar y con soportes → EN_REVISION', () => {
    expect(clasificarAccion({ ...base, total_soportes: 1 }, hoy).grupo).toBe(
      'EN_REVISION',
    );
  });

  it('cargue cerrado, sin calificar y sin soportes → PENDIENTE_HABILITAR', () => {
    expect(clasificarAccion(base, hoy).grupo).toBe('PENDIENTE_HABILITAR');
  });

  it('el cargue abierto tiene precedencia sobre la calificación', () => {
    const r = clasificarAccion(
      { ...base, en_revision: true, calificacion: 90, total_soportes: 3 },
      hoy,
    );
    expect(r.grupo).toBe('CARGUE_ABIERTO');
  });

  it('eficaz desde el umbral: 80 sí, 79 no', () => {
    expect(clasificarAccion({ ...base, calificacion: 80 }, hoy).eficaz).toBe(
      true,
    );
    expect(clasificarAccion({ ...base, calificacion: 79 }, hoy).eficaz).toBe(
      false,
    );
  });

  it('en riesgo con fecha_fin a 30 días, no a 31', () => {
    expect(
      clasificarAccion({ ...base, fecha_fin: fechaEn(30, hoy) }, hoy).en_riesgo,
    ).toBe(true);
    expect(
      clasificarAccion({ ...base, fecha_fin: fechaEn(31, hoy) }, hoy).en_riesgo,
    ).toBe(false);
  });

  it('vencida y sin calificar está en riesgo; vencida con 85 no', () => {
    const vencida = fechaEn(-3, hoy);
    const sinCalificar = clasificarAccion({ ...base, fecha_fin: vencida }, hoy);
    expect(sinCalificar.en_riesgo).toBe(true);
    expect(sinCalificar.dias_para_vencer).toBe(-3);
    expect(
      clasificarAccion({ ...base, fecha_fin: vencida, calificacion: 85 }, hoy)
        .en_riesgo,
    ).toBe(false);
  });

  it('sin fecha_fin no hay riesgo ni días para vencer', () => {
    const r = clasificarAccion(base, hoy);
    expect(r.en_riesgo).toBe(false);
    expect(r.dias_para_vencer).toBeNull();
  });
});

// ── Servicio ────────────────────────────────────────────────

const planes = [
  {
    _id: 'p1',
    auditoria_id: 'a1',
    estado_id: ESTADO.APROBADO_PLAN_MEJORAMIENTO,
  },
  { _id: 'p2', auditoria_id: 'a2', estado_id: ESTADO.FIN_PLAN_MEJORAMIENTO },
  // Otro tipo de evaluación: queda fuera
  {
    _id: 'p3',
    auditoria_id: 'a3',
    estado_id: ESTADO.APROBADO_PLAN_MEJORAMIENTO,
  },
];

const auditoriasCrud: Record<string, any> = {
  a1: { consecutivo_no_auditoria: 1, auditoria_padre_id: 'pa1' },
  a2: { consecutivo_no_auditoria: 2, auditoria_padre_id: 'pa2' },
  a3: { consecutivo_no_auditoria: 3, auditoria_padre_id: 'pa3' },
};

const padresCrud: Record<string, any> = {
  pa1: { titulo: 'Sistemas', tipo_evaluacion_id: 6770 },
  pa2: { titulo: 'Contratación', tipo_evaluacion_id: 6770 },
  pa3: { titulo: 'Seguimiento', tipo_evaluacion_id: 6771 },
};

const accionesCrud = () => [
  {
    _id: 'ac1',
    plan_mejoramiento_id: 'p1',
    hallazgo_id: { no_hallazgo: '1.1.1', descripcion: 'Hallazgo uno' },
    no_accion: '2025-1.1',
    tipo_id: 2,
    descripcion: 'Acción uno',
    en_revision: true,
    fecha_inicio: fechaEn(-30),
    fecha_fin: fechaEn(5),
  },
  {
    _id: 'ac2',
    plan_mejoramiento_id: 'p1',
    hallazgo_id: { no_hallazgo: '1.2.1', descripcion: 'Hallazgo dos' },
    no_accion: '2025-1.2',
    tipo_id: 1,
    descripcion: 'Acción dos',
    en_revision: false,
    fecha_inicio: fechaEn(-30),
    fecha_fin: fechaEn(200),
  },
  {
    _id: 'ac3',
    plan_mejoramiento_id: 'p2',
    hallazgo_id: { no_hallazgo: '2.1.1', descripcion: 'Hallazgo tres' },
    no_accion: '2025-2.1',
    tipo_id: 2,
    descripcion: 'Acción tres',
    en_revision: false,
    fecha_inicio: fechaEn(-30),
    fecha_fin: fechaEn(60),
  },
  {
    _id: 'ac4',
    plan_mejoramiento_id: 'p2',
    hallazgo_id: { no_hallazgo: '2.2.1', descripcion: 'Hallazgo cuatro' },
    no_accion: '2025-2.2',
    tipo_id: 2,
    descripcion: 'Acción cuatro',
    en_revision: false,
    fecha_inicio: fechaEn(-30),
    fecha_fin: fechaEn(-10),
  },
  {
    _id: 'ac5',
    plan_mejoramiento_id: 'p3',
    hallazgo_id: { no_hallazgo: '3.1.1', descripcion: 'Hallazgo cinco' },
    no_accion: '2025-3.1',
    tipo_id: 2,
    descripcion: 'Acción cinco',
    en_revision: true,
    fecha_inicio: fechaEn(-30),
    fecha_fin: fechaEn(10),
  },
];

const respuestasCrud: Record<string, any[]> = {
  'plan-mejoramiento': planes,
  // Persona 10: auditor de la auditoría a1
  auditor: [{ auditoria_id: 'a1', auditor_id: 10 }],
  // Persona 20: auditor del plan p2
  'plan-mejoramiento-auditor': [{ plan_mejoramiento_id: 'p2', auditor_id: 20 }],
  'responsable-accion': [
    { accion_mejora_id: 'ac1', dependencia_id: 32, dependencia_lider: true },
    { accion_mejora_id: 'ac2', dependencia_id: 32, dependencia_lider: true },
    { accion_mejora_id: 'ac2', dependencia_id: 45, dependencia_lider: false },
    { accion_mejora_id: 'ac3', dependencia_id: 99, dependencia_lider: true },
    { accion_mejora_id: 'ac4', dependencia_id: 32, dependencia_lider: true },
    { accion_mejora_id: 'ac5', dependencia_id: 32, dependencia_lider: true },
  ],
  documento: [{ referencia_id: 'ac2' }, { referencia_id: 'ac2' }],
  'calificacion-accion': [
    {
      accion_mejora_id: 'ac4',
      calificacion: 85,
      fecha_calificacion: '2025-01-01T10:00:00Z',
    },
  ],
};

describe('GestionAccionesService (vistas auditado y auditor)', () => {
  let service: GestionAccionesService;
  const auditoriaCrudService = {
    traerDataCrud: jest.fn(
      (endpoint: string, id: string | null, params?: any) => {
        if (endpoint === 'auditoria') {
          return Promise.resolve({ Data: auditoriasCrud[id as string] });
        }
        if (endpoint === 'auditoria-padre') {
          return Promise.resolve({ Data: padresCrud[id as string] });
        }
        if (endpoint === 'accion-mejora') {
          // Como el CRUD: solo las acciones de los planes pedidos
          const pedidos = String(params?.query ?? '')
            .split('plan_mejoramiento_id__in:')[1]
            ?.split(',')[0]
            .split('|');
          return Promise.resolve({
            Data: accionesCrud().filter((a) =>
              pedidos?.includes(a.plan_mejoramiento_id),
            ),
          });
        }
        return Promise.resolve({ Data: respuestasCrud[endpoint] ?? [] });
      },
    ),
  };
  const getDependenciasByPersona = jest.fn();
  const query = { vigencia_id: '1', tipo_evaluacion_id: '6770' };

  const ids = (res: any) => res.Data.map((f: any) => f.accion_id);

  beforeEach(async () => {
    auditoriaCrudService.traerDataCrud.mockClear();
    getDependenciasByPersona.mockReset().mockResolvedValue([32, 45]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GestionAccionesService,
        { provide: AuditoriaCrudService, useValue: auditoriaCrudService },
        {
          provide: TercerosHelperService,
          useValue: {
            getDependenciasByPersona,
            getTerceroById: jest
              .fn()
              .mockResolvedValue({ NombreCompleto: 'Pedro Fuentes' }),
          },
        },
        {
          provide: DominiosService,
          useValue: {
            getParametros: () =>
              of({ parametros: [{ Id: 6770, Nombre: 'Auditoría Interna' }] }),
            getDependencias: () =>
              of({
                parametros: [
                  { Id: 32, Nombre: 'Oficina A' },
                  { Id: 45, Nombre: 'Oficina B' },
                  { Id: 99, Nombre: 'Oficina Z' },
                ],
              }),
          },
        },
      ],
    }).compile();

    service = module.get<GestionAccionesService>(GestionAccionesService);
  });

  describe('auditado', () => {
    it('sin dependencias vinculadas devuelve vacío', async () => {
      getDependenciasByPersona.mockResolvedValue([]);

      const res = await service.getAllAuditado(5, 312, query);

      expect(res.Data).toEqual([]);
      expect(res.MetaData.Count).toBe(0);
    });

    it('excluye las acciones cuyas dependencias responsables no son suyas', async () => {
      const res = await service.getAllAuditado(5, 312, query);

      expect(ids(res)).toEqual(['ac1', 'ac2', 'ac4']);
      expect(res.MetaData.Count).toBe(3);
    });

    it('arma la fila con líder, apoyo, auditores, soportes y calificación', async () => {
      const res = await service.getAllAuditado(5, 312, query);
      const ac2 = res.Data.find((f: any) => f.accion_id === 'ac2');
      const ac4 = res.Data.find((f: any) => f.accion_id === 'ac4');

      expect(ac2).toMatchObject({
        no_auditoria: '1',
        nombre_auditoria: 'Sistemas',
        tipo_evaluacion_nombre: 'Auditoría Interna',
        no_hallazgo: '1.2.1',
        tipo_accion_nombre: 'Preventiva',
        dependencia_lider: 'Oficina A',
        dependencias_apoyo: ['Oficina B'],
        total_soportes: 2,
        grupo: 'EN_REVISION',
        auditor_plan_asignado: false,
      });
      expect(ac4).toMatchObject({
        calificacion: 85,
        grupo: 'CALIFICADAS',
        eficaz: true,
        en_riesgo: false,
        auditores_plan: ['Pedro Fuentes'],
      });
    });

    it('solo consulta planes en estado aprobado o fin', async () => {
      await service.getAllAuditado(5, 312, query);

      const llamada = auditoriaCrudService.traerDataCrud.mock.calls.find(
        ([endpoint]) => endpoint === 'plan-mejoramiento',
      ) as any[];
      expect(llamada[2].query).toContain(
        `estado_id__in:${ESTADO.APROBADO_PLAN_MEJORAMIENTO}|${ESTADO.FIN_PLAN_MEJORAMIENTO}`,
      );
      expect(llamada[2].query).toContain('vigencia_id:1');
    });

    it('sin vigencia o tipo de evaluación devuelve vacío sin consultar', async () => {
      const res = await service.getAllAuditado(5, 312, { vigencia_id: '1' });

      expect(res.Data).toEqual([]);
      expect(auditoriaCrudService.traerDataCrud).not.toHaveBeenCalled();
    });
  });

  describe('auditor', () => {
    it('asignadas: incluye por auditor de la auditoría', async () => {
      const res = await service.getAllAuditor(10, query);

      expect(ids(res)).toEqual(['ac1', 'ac2']);
      // Es auditor de la auditoría, no del plan: no puede habilitar ni calificar
      expect(
        res.Data.every((f: any) => f.auditor_plan_asignado === false),
      ).toBe(true);
    });

    it('asignadas: incluye por auditor del plan y lo marca asignado', async () => {
      const res = await service.getAllAuditor(20, query);

      expect(ids(res)).toEqual(['ac3', 'ac4']);
      expect(res.Data.every((f: any) => f.auditor_plan_asignado === true)).toBe(
        true,
      );
    });

    it('asignadas: excluye a quien no está asignado', async () => {
      const res = await service.getAllAuditor(77, query);

      expect(res.Data).toEqual([]);
    });

    it('todas: incluye todas las acciones del tipo de evaluación, sin ac5', async () => {
      const res = await service.getAllAuditor(77, {
        ...query,
        alcance: 'todas',
      });

      expect(ids(res)).toEqual(['ac1', 'ac2', 'ac3', 'ac4']);
    });
  });

  describe('filtros', () => {
    const todas = { ...query, alcance: 'todas' };

    it('grupo=EN_RIESGO deja las no eficaces con fecha en 30 días o vencidas', async () => {
      const res = await service.getAllAuditor(77, {
        ...todas,
        grupo: 'EN_RIESGO',
      });

      // ac1 vence en 5 días; ac4 está vencida pero es eficaz (85)
      expect(ids(res)).toEqual(['ac1']);
    });

    it('grupo=CALIFICADAS filtra por el grupo de la fila', async () => {
      const res = await service.getAllAuditor(77, {
        ...todas,
        grupo: 'CALIFICADAS',
      });

      expect(ids(res)).toEqual(['ac4']);
    });

    it('accion_hallazgo busca en el número de acción y en el de hallazgo', async () => {
      const porHallazgo = await service.getAllAuditor(77, {
        ...todas,
        accion_hallazgo: '1.1.1',
      });
      const porAccion = await service.getAllAuditor(77, {
        ...todas,
        accion_hallazgo: '2025-2.2',
      });

      expect(ids(porHallazgo)).toEqual(['ac1']);
      expect(ids(porAccion)).toEqual(['ac4']);
    });

    it('desde excluye las acciones que terminan antes', async () => {
      const res = await service.getAllAuditor(77, {
        ...todas,
        desde: fechaEn(100),
      });

      expect(ids(res)).toEqual(['ac2']);
    });

    it('hasta excluye las acciones que empiezan después', async () => {
      const antes = await service.getAllAuditor(77, {
        ...todas,
        hasta: fechaEn(-40),
      });
      const despues = await service.getAllAuditor(77, {
        ...todas,
        hasta: fechaEn(-20),
      });

      expect(antes.Data).toEqual([]);
      expect(ids(despues)).toEqual(['ac1', 'ac2', 'ac3', 'ac4']);
    });

    it('dependencia busca en la líder y en las de apoyo', async () => {
      const res = await service.getAllAuditor(77, {
        ...todas,
        dependencia: 'oficina b',
      });

      expect(ids(res)).toEqual(['ac2']);
    });

    it('pagina sobre el total filtrado', async () => {
      const res = await service.getAllAuditor(77, {
        ...todas,
        limit: '2',
        offset: '2',
      });

      expect(ids(res)).toEqual(['ac3', 'ac4']);
      expect(res.MetaData.Count).toBe(4);
    });
  });

  describe('resumen', () => {
    it('cuenta por grupo e ignora el grupo y los filtros de texto', async () => {
      const res = await service.getResumenAuditor(77, {
        ...query,
        alcance: 'todas',
        grupo: 'CALIFICADAS',
        no_auditoria: '999',
        accion_hallazgo: 'zzz',
      });

      expect(res.Data).toEqual({
        total: 4,
        pendiente_habilitar: 1,
        cargue_abierto: 1,
        en_revision: 1,
        calificadas: 1,
        eficaces: 1,
        en_riesgo: 1,
      });
    });

    it('del auditado cuenta solo las acciones de sus dependencias', async () => {
      const res = await service.getResumenAuditado(5, 312, query);

      expect(res.Data.total).toBe(3);
      expect(res.Data.pendiente_habilitar).toBe(0);
    });

    it('sin vigencia devuelve todos los conteos en cero', async () => {
      const res = await service.getResumenAuditado(5, 312, {});

      expect(Object.values(res.Data).every((v) => v === 0)).toBe(true);
    });
  });
});
