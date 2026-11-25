import {
  BadRequestException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { environment } from 'src/config/configuration';
import {
  AUDITORIA_EXTERNA_ID,
  crearAuditoriaGuardada,
  crearEscenario,
} from '../../../test/fixtures/auditoria-externa';

describe('AuditoriaExternaService.listar', () => {
  it('lista activas, de la más reciente a la más antigua, con el nombre de la vigencia', async () => {
    const { service, crud } = await crearEscenario({
      listado: [crearAuditoriaGuardada()],
    });

    const r = await service.listar({
      vigencia_id: '2025',
      limit: '10',
      offset: '5',
    });

    expect(crud.traerDataCrud).toHaveBeenCalledWith('auditoria-externa', null, {
      query: 'vigencia_id:2025,activo:true',
      sortby: 'fecha_creacion',
      order: 'desc',
      limit: 10,
      offset: 5,
    });
    expect(r.Status).toBe(HttpStatus.OK);
    expect(r.Data[0].vigencia_nombre).toBe('2025');
    expect(r.MetaData.Count).toBe(1);
  });

  it('sin vigencia lista todas las activas con el límite por defecto', async () => {
    const { service, crud } = await crearEscenario({ listado: [] });

    const r = await service.listar({});

    expect(crud.traerDataCrud).toHaveBeenCalledWith(
      'auditoria-externa',
      null,
      expect.objectContaining({
        query: 'activo:true',
        limit: environment.AUDITORIA_EXTERNA.LIMITE_POR_DEFECTO,
      }),
    );
    expect(r.Data).toEqual([]);
  });

  it.each([
    [{ vigencia_id: 'abc' }],
    [{ vigencia_id: '-1' }],
    [{ limit: '0' }],
    [{ limit: '101' }],
    [{ offset: '-1' }],
    [{ limit: 'x' }],
  ])('rechaza con 400 los parámetros inválidos %j', async (query) => {
    const { service, crud } = await crearEscenario();

    await expect(service.listar(query)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(crud.traerDataCrud).not.toHaveBeenCalled();
  });
});

describe('AuditoriaExternaService.obtener', () => {
  const hallazgo = {
    _id: 'h1',
    vigencia_id: 2025,
    codigo_auditoria: 'PAD-2025-01',
    numeral: '3.1.1.1',
    descripcion: 'Deficiencias en la supervisión',
    dependencia_id: [32, 45],
  };

  it('devuelve los datos con hallazgos, dependencias por nombre, informe y plan', async () => {
    const { service } = await crearEscenario({
      hallazgos: [hallazgo],
      documentos: [
        {
          tipo_id: environment.DOCUMENTO.TIPO_INFORME_FINAL,
          nuxeo_id: 1234,
          nuxeo_enlace: 'https://nuxeo.example/informe.pdf',
        },
      ],
      plan: { _id: 'p1', estado_id: 7081 },
    });

    const r = await service.obtener(AUDITORIA_EXTERNA_ID);

    expect(r.Data).toEqual(
      expect.objectContaining({
        _id: AUDITORIA_EXTERNA_ID,
        vigencia_nombre: '2025',
        dependencias_nombre: [
          'Oficina de Control Interno',
          'Oficina Asesora de Planeación',
        ],
        informe_final: {
          nuxeo_id: 1234,
          nuxeo_enlace: 'https://nuxeo.example/informe.pdf',
        },
        plan_mejoramiento: { _id: 'p1', estado_id: 7081 },
      }),
    );
    expect(r.Data.hallazgos).toEqual([
      expect.objectContaining({
        numeral: '3.1.1.1',
        vigencia_nombre: '2025',
        dependencias_nombre: [
          'Oficina de Control Interno',
          'Oficina Asesora de Planeación',
        ],
      }),
    ]);
  });

  it('informe y plan quedan en null si no existen', async () => {
    const { service } = await crearEscenario({ hallazgos: [] });

    const r = await service.obtener(AUDITORIA_EXTERNA_ID);

    expect(r.Data.informe_final).toBeNull();
    expect(r.Data.plan_mejoramiento).toBeNull();
    expect(r.Data.hallazgos).toEqual([]);
  });

  it('lanza 404 si la auditoría no existe o está inactiva', async () => {
    const { service } = await crearEscenario({ auditoria: null });

    await expect(service.obtener(AUDITORIA_EXTERNA_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it.each([
    '',
    'abc',
    '672d4a11f7814a9a0c5261e',
    '672d4a11f7814a9a0c5261e1,activo:false',
  ])(
    'rechaza con 400 el id inválido "%s" sin consultar el CRUD',
    async (id) => {
      const { service, crud } = await crearEscenario();

      await expect(service.obtener(id)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(crud.traerDataCrud).not.toHaveBeenCalled();
    },
  );
});
