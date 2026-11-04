import { Test, TestingModule } from '@nestjs/testing';
import { of } from 'rxjs';
import { AuditoriaService } from 'src/application/auditoria/auditoria.service';
import { AuditoriaCrudService } from 'src/shared/services/auditoria-crud.service';
import { NuxeoService } from 'src/shared/services/nuxeo.service';
import { OikosService } from 'src/shared/services/oikos.service';
import { PlantillasMidService } from 'src/shared/services/plantillas-mid.service';
import { TercerosHelperService } from 'src/shared/services/terceros-helper.service';
import { PlantillaInformeAuditoriaService } from './plantilla-informe-auditoria.service';
import {
  contenidoNuxeoBase64,
  crearTema,
  enlaceNuxeo,
  htmlConImagen,
} from '../../../../test/fixtures/plantilla';

describe('PlantillaInformeAuditoriaService - temas con NuxeoEnlace', () => {
  let service: PlantillaInformeAuditoriaService;
  const nuxeoServiceMock = { obtenerPorUUID: jest.fn() };

  const procesarDescripcionTemas = (temas: any[]) =>
    service['procesarDescripcionTemas'](temas);

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlantillaInformeAuditoriaService,
        { provide: PlantillasMidService, useValue: {} },
        { provide: AuditoriaCrudService, useValue: {} },
        { provide: AuditoriaService, useValue: {} },
        { provide: TercerosHelperService, useValue: {} },
        { provide: OikosService, useValue: {} },
        { provide: NuxeoService, useValue: nuxeoServiceMock },
      ],
    }).compile();

    service = module.get<PlantillaInformeAuditoriaService>(
      PlantillaInformeAuditoriaService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('reemplaza el enlace por el HTML del gestor documental, con imágenes y tildes', async () => {
    nuxeoServiceMock.obtenerPorUUID.mockReturnValue(
      of(contenidoNuxeoBase64(htmlConImagen)),
    );
    const tema = crearTema({ descripcion_titulo: enlaceNuxeo('uuid-1') });

    const [resultado] = await procesarDescripcionTemas([tema]);

    expect(nuxeoServiceMock.obtenerPorUUID).toHaveBeenCalledWith('uuid-1');
    expect(resultado).toEqual({ ...tema, descripcion_titulo: htmlConImagen });
    expect(resultado.descripcion_titulo).toContain('Evaluación del área');
    expect(resultado.descripcion_titulo).toContain(
      '<img src="data:image/png;base64,',
    );
  });

  it('conserva el orden de los temas y deja intactos los que no tienen enlace', async () => {
    nuxeoServiceMock.obtenerPorUUID.mockImplementation((uuid: string) =>
      of(contenidoNuxeoBase64(`<p>Contenido ${uuid}</p>`)),
    );
    const temaSinEnlace = crearTema({ _id: 'tema-2' });
    const temas = [
      crearTema({ _id: 'tema-1', descripcion_titulo: enlaceNuxeo('uuid-1') }),
      temaSinEnlace,
      crearTema({ _id: 'tema-3', descripcion_titulo: enlaceNuxeo('uuid-3') }),
    ];

    const resultado = await procesarDescripcionTemas(temas);

    expect(resultado.map((tema) => tema._id)).toEqual([
      'tema-1',
      'tema-2',
      'tema-3',
    ]);
    expect(resultado.map((tema) => tema.descripcion_titulo)).toEqual([
      '<p>Contenido uuid-1</p>',
      temaSinEnlace.descripcion_titulo,
      '<p>Contenido uuid-3</p>',
    ]);
    expect(resultado[1]).toBe(temaSinEnlace);
    expect(nuxeoServiceMock.obtenerPorUUID).toHaveBeenCalledTimes(2);
  });

  it('no interrumpe el procesamiento cuando el gestor documental falla', async () => {
    nuxeoServiceMock.obtenerPorUUID
      .mockReturnValueOnce(of(''))
      .mockReturnValueOnce(of(contenidoNuxeoBase64('<p>Segundo tema</p>')));
    const temas = [
      crearTema({
        _id: 'tema-1',
        descripcion_titulo: enlaceNuxeo('uuid-invalido'),
      }),
      crearTema({ _id: 'tema-2', descripcion_titulo: enlaceNuxeo('uuid-2') }),
    ];

    const resultado = await procesarDescripcionTemas(temas);

    expect(resultado.map((tema) => tema.descripcion_titulo)).toEqual([
      '',
      '<p>Segundo tema</p>',
    ]);
  });

  it('no consulta el gestor documental cuando ningún tema tiene enlace', async () => {
    const temas = [
      crearTema(),
      crearTema({ _id: 'tema-2', descripcion_titulo: null }),
    ];

    const resultado = await procesarDescripcionTemas(temas);

    expect(resultado).toEqual(temas);
    expect(nuxeoServiceMock.obtenerPorUUID).not.toHaveBeenCalled();
  });
});
