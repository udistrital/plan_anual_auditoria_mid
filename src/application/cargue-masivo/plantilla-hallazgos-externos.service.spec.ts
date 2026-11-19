import {
  HttpException,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import ExcelJS from 'exceljs';
import { of } from 'rxjs';
import { environment } from 'src/config/configuration';
import { NuxeoService } from 'src/shared/services/nuxeo.service';
import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
} from 'src/shared/utils/base64.utils';
import { DominiosService } from 'src/shared/utils/dominios/dominios.service';
import { PlantillaHallazgosExternosService } from './plantilla-hallazgos-externos.service';

const UUID = 'uuid-plantilla-hallazgos';

/** Plantilla mínima como la de Nuxeo: hoja de datos con encabezados y hoja `origen` con sus títulos. */
async function crearPlantillaBase64(): Promise<string> {
  const libro = new ExcelJS.Workbook();
  const datos = libro.addWorksheet('hallazgos');
  datos.getRow(1).values = [
    'Vigencia',
    'Código de Auditoría',
    'No. Hallazgo',
    'Descripción',
    'Dependencias',
  ];
  // Como la plantilla real: 500 filas de datos vacías pero con formato
  for (let fila = 2; fila <= 502; fila++) {
    for (let col = 1; col <= 5; col++) {
      datos.getRow(fila).getCell(col).border = { bottom: { style: 'thin' } };
    }
  }
  const origen = libro.addWorksheet('origen');
  origen.getCell('B2').value = 'Vigencia';
  origen.getCell('C2').value = 'Dependencias';
  return arrayBufferToBase64((await libro.xlsx.writeBuffer()) as ArrayBuffer);
}

async function crearEscenario(
  plantilla: string | Promise<string> = crearPlantillaBase64(),
) {
  const nuxeo = { obtenerPorUUID: jest.fn(() => of(plantilla)) };
  const dominios = {
    getParametros: jest.fn(() =>
      of({
        parametros: [
          { Id: 2, Nombre: '2025' },
          { Id: 1, Nombre: '2024' },
          { Id: 3, Nombre: '2025' },
        ],
      }),
    ),
    getDependencias: jest.fn(() =>
      of({
        parametros: [
          { Id: 45, Nombre: 'Planeación' },
          { Id: 32, Nombre: 'Control Interno' },
        ],
      }),
    ),
  };
  const module = await Test.createTestingModule({
    providers: [
      PlantillaHallazgosExternosService,
      { provide: NuxeoService, useValue: nuxeo },
      { provide: DominiosService, useValue: dominios },
    ],
  }).compile();
  return { service: module.get(PlantillaHallazgosExternosService), nuxeo };
}

async function leer(base64: string): Promise<ExcelJS.Workbook> {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(base64ToArrayBuffer(base64));
  return libro;
}

describe('PlantillaHallazgosExternosService', () => {
  const uuidOriginal = environment.PLANTILLA_CARGUE_MASIVO_HALLAZGOS_EXTERNOS;
  beforeEach(() => {
    environment.PLANTILLA_CARGUE_MASIVO_HALLAZGOS_EXTERNOS = UUID;
  });
  afterEach(() => {
    environment.PLANTILLA_CARGUE_MASIVO_HALLAZGOS_EXTERNOS = uuidOriginal;
  });

  it('responde 503 sin consultar Nuxeo mientras el ambiente no tenga el UUID de la plantilla', async () => {
    environment.PLANTILLA_CARGUE_MASIVO_HALLAZGOS_EXTERNOS = '';
    const { service, nuxeo } = await crearEscenario();

    await expect(service.obtener()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(nuxeo.obtenerPorUUID).not.toHaveBeenCalled();
  });

  it('pide la plantilla a Nuxeo por el UUID configurado', async () => {
    const { service, nuxeo } = await crearEscenario();

    await service.obtener();

    expect(nuxeo.obtenerPorUUID).toHaveBeenCalledWith(UUID);
  });

  it('escribe en la hoja origen las vigencias y las dependencias, únicas y ordenadas', async () => {
    const { service } = await crearEscenario();

    const { base64 } = await service.obtener();

    const origen = (await leer(base64)).getWorksheet('origen')!;
    expect([3, 4].map((f) => origen.getCell(`B${f}`).value)).toEqual([
      '2024',
      '2025',
    ]);
    expect([3, 4].map((f) => origen.getCell(`C${f}`).value)).toEqual([
      'Control Interno',
      'Planeación',
    ]);
  });

  it('valida con lista solo la columna Vigencia, hasta la fila 501 (500 hallazgos)', async () => {
    const { service } = await crearEscenario();

    const { base64 } = await service.obtener();

    const hoja = (await leer(base64)).worksheets[0];
    expect(hoja.getCell('A2').dataValidation).toEqual(
      expect.objectContaining({ type: 'list', formulae: ['origen!$B$3:$B$4'] }),
    );
    expect(hoja.getCell('A501').dataValidation?.type).toBe('list');
    expect(hoja.getCell('A502').dataValidation).toBeFalsy();
  });

  it('deja Dependencias sin validación de celda (admite varias separadas por |)', async () => {
    const { service } = await crearEscenario();

    const { base64 } = await service.obtener();

    const hoja = (await leer(base64)).worksheets[0];
    expect(hoja.getCell('E2').dataValidation).toBeFalsy();
    expect(hoja.getCell('B2').dataValidation).toBeFalsy();
    expect(hoja.getCell('C2').dataValidation).toBeFalsy();
  });

  it('conserva los encabezados de la plantilla (los que lee la validación del archivo)', async () => {
    const { service } = await crearEscenario();

    const { base64 } = await service.obtener();

    const hoja = (await leer(base64)).worksheets[0];
    expect([1, 2, 3, 4, 5].map((c) => hoja.getRow(1).getCell(c).value)).toEqual(
      [
        'Vigencia',
        'Código de Auditoría',
        'No. Hallazgo',
        'Descripción',
        'Dependencias',
      ],
    );
  });

  it('responde 502 si Nuxeo no devuelve el archivo', async () => {
    const { service } = await crearEscenario('');

    const error = await service.obtener().catch((e) => e);

    expect(error).toBeInstanceOf(HttpException);
    expect(error.getStatus()).toBe(HttpStatus.BAD_GATEWAY);
  });
});
