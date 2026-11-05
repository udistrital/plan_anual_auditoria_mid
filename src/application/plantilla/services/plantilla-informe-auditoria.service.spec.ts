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
});
