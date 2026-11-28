import { PlantillaInformeAuditoriaService } from './plantilla-informe-auditoria.service';
import { environment } from 'src/config/configuration';

describe('PlantillaInformeAuditoriaService', () => {
  const auditoriaCrudService = { traerDataCrud: jest.fn() };
  const servicio = new PlantillaInformeAuditoriaService(
    {} as any,
    auditoriaCrudService as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );

  beforeEach(() => jest.clearAllMocks());

  describe('esInformePreliminar', () => {
    it('retorna true si el estado actual es preliminar', async () => {
      const estado = environment.ESTADOS_INFORME_AUDITORIA_PRELIMINAR[0];
      auditoriaCrudService.traerDataCrud.mockResolvedValue({
        Data: [{ estado_id: estado }],
      });
      await expect((servicio as any).esInformePreliminar('a1')).resolves.toBe(
        true,
      );
    });

    it('retorna false si el estado actual no es preliminar', async () => {
      auditoriaCrudService.traerDataCrud.mockResolvedValue({
        Data: [{ estado_id: -1 }],
      });
      await expect((servicio as any).esInformePreliminar('a1')).resolves.toBe(
        false,
      );
    });

    it('retorna false si no hay estado actual', async () => {
      auditoriaCrudService.traerDataCrud.mockResolvedValue({ Data: [] });
      await expect((servicio as any).esInformePreliminar('a1')).resolves.toBe(
        false,
      );
    });
  });

  describe('generarTituloInforme', () => {
    it('agrega el sufijo según el tipo de informe', () => {
      const tipoInterna = environment.TIPO_EVALUACION.AUDITORIA_INTERNA;
      expect(
        (servicio as any).generarTituloInforme(tipoInterna, 'X', true),
      ).toBe('Auditoria Interna: X - Preliminar');
      expect(
        (servicio as any).generarTituloInforme(tipoInterna, 'X', false),
      ).toBe('Auditoria Interna: X - Final');
    });
  });

  describe('reestructurarTemas', () => {
    it('limpia descripciones vacías de temas y subtemas', async () => {
      const temas = [
        {
          _id: 't1',
          descripcion_titulo: '<p><br></p>',
          subtema: [
            { _id: 's1', descripcion: '<p><br></p>' },
            { _id: 's2', descripcion: '<p>Texto</p>' },
          ],
        },
      ];
      const [tema] = await (servicio as any).reestructurarTemas(temas, []);
      expect(tema.descripcion_titulo).toBe('');
      expect(tema.subtemas[0].descripcion).toBe('');
      expect(tema.subtemas[1].descripcion).toBe('<p>Texto</p>');
    });

    it('numera los subtemas como {tema}.{subtema} sin contar los inactivos', async () => {
      const temas = [
        { _id: 't1', subtema: [{ _id: 's1' }, { _id: 's2', activo: false }, { _id: 's3' }] },
        { _id: 't2', subtema: [{ _id: 's4' }] },
      ];
      const [t1, t2] = await (servicio as any).reestructurarTemas(temas, []);
      expect(t1.subtemas.map((s: any) => s.numero)).toEqual(['2.1', '', '2.2']);
      expect(t2.subtemas[0].numero).toBe('3.1');
    });
  });

  describe('obtenerObservacionesPorHallazgo', () => {
    it('incluye la observación del auditor aunque no tenga dependencia asociada', async () => {
      auditoriaCrudService.traerDataCrud.mockResolvedValue({
        Data: [
          {
            hallazgo_id: 'h1',
            usuario_rol: 'AUDITOR',
            dependencia_id: [],
            observacion: '<p>Recomendación del auditor</p>',
          },
        ],
      });

      const resultado = await (servicio as any).obtenerObservacionesPorHallazgo(
        [{ _id: 'h1' }],
      );
      const [tema] = await (servicio as any).reestructurarTemas(
        [{ _id: 't1', subtema: [{ _id: 's1' }] }],
        [{ _id: 'h1', subtema_id: 's1' }],
        resultado.respuestasPorHallazgo,
        resultado.observacionesAuditorPorHallazgo,
      );

      expect(resultado.observacionesAuditorPorHallazgo.get('h1')).toBe(
        '<p>Recomendación del auditor</p>',
      );
      expect(tema.subtemas[0].hallazgos[0].observacion_auditor).toBe(
        '<p>Recomendación del auditor</p>',
      );
      expect(auditoriaCrudService.traerDataCrud).toHaveBeenCalledWith(
        'observacion',
        null,
        { query: 'hallazgo_id__in:h1,activo:true', limit: 0 },
      );
    });

    it('evita repetir una respuesta cuando el registro tiene dependencias duplicadas', async () => {
      auditoriaCrudService.traerDataCrud.mockResolvedValue({
        Data: [
          {
            hallazgo_id: 'h1',
            usuario_rol: 'JEFE_DEPENDENCIA',
            dependencia_id: [121, 121, 121],
            observacion: 'Respuesta de la dependencia',
          },
        ],
      });
      const oikosService = {
        traerData: jest.fn().mockResolvedValue({ Nombre: 'Dependencia X' }),
      };
      const serviceWithOikos = new PlantillaInformeAuditoriaService(
        {} as any,
        auditoriaCrudService as any,
        {} as any,
        {} as any,
        oikosService as any,
        {} as any,
      );

      const resultado = await (serviceWithOikos as any)
        .obtenerObservacionesPorHallazgo([{ _id: 'h1' }]);

      expect(resultado.respuestasPorHallazgo.get('h1')).toEqual([
        {
          dependencia_id: 121,
          encabezado: 'Respuesta Dependencia X',
          contenido: 'Respuesta de la dependencia',
        },
      ]);
      expect(oikosService.traerData).toHaveBeenCalledTimes(1);
    });
  });

  describe('obtenerAuditoresAsignados', () => {
    const tercerosService = { getTerceroById: jest.fn() };
    const conTerceros = new PlantillaInformeAuditoriaService(
      {} as any,
      auditoriaCrudService as any,
      {} as any,
      tercerosService as any,
      {} as any,
      {} as any,
    );
    const nombres: Record<number, string> = { 1: 'Ana', 2: 'Luis', 3: 'Marta' };

    it('devuelve todos los auditores activos con el líder primero', async () => {
      auditoriaCrudService.traerDataCrud.mockResolvedValue({
        Data: [
          { auditor_id: 1 },
          { auditor_id: 2, auditor_lider: true },
          { auditor_id: 3 },
        ],
      });
      tercerosService.getTerceroById.mockImplementation(async (id: number) => ({ NombreCompleto: nombres[id] }));

      const auditores = await (conTerceros as any).obtenerAuditoresAsignados('a1');

      expect(auditoriaCrudService.traerDataCrud).toHaveBeenCalledWith('auditor', null, {
        query: 'auditoria_id:a1,activo:true',
        limit: 0,
      });
      expect(auditores).toEqual([
        { nombre: 'Luis', cargo: 'Auditor líder' },
        { nombre: 'Ana', cargo: 'Auditor' },
        { nombre: 'Marta', cargo: 'Auditor' },
      ]);
    });

    it('omite a quien no aparece en Terceros y tolera la lista vacía', async () => {
      auditoriaCrudService.traerDataCrud.mockResolvedValue({ Data: [{ auditor_id: 1 }, { auditor_id: 9 }] });
      tercerosService.getTerceroById.mockImplementation(async (id: number) => (nombres[id] ? { NombreCompleto: nombres[id] } : null));
      await expect((conTerceros as any).obtenerAuditoresAsignados('a1')).resolves.toEqual([{ nombre: 'Ana', cargo: 'Auditor' }]);

      auditoriaCrudService.traerDataCrud.mockResolvedValue({ Data: [] });
      await expect((conTerceros as any).obtenerAuditoresAsignados('a1')).resolves.toEqual([]);
    });
  });
});
