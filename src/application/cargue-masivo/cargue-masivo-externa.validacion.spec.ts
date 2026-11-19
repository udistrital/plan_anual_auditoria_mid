import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import ExcelJS from 'exceljs';
import { of } from 'rxjs';
import { DominiosService } from 'src/shared/utils/dominios/dominios.service';
import { MAX_HALLAZGOS_EXTERNOS } from 'src/shared/utils/validar-hallazgo-externo.util';
import {
  COLUMNAS_HALLAZGOS_EXTERNOS,
  CargueMasivoExternaService,
} from './cargue-masivo-externa.service';

const ENCABEZADOS = Object.values(COLUMNAS_HALLAZGOS_EXTERNOS);

/** Arma un xlsx en memoria y lo entrega en Base64, como llega desde el MF. */
async function crearArchivo(
  filas: unknown[][],
  encabezados: string[] = ENCABEZADOS,
): Promise<string> {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet('Hallazgos');
  hoja.addRow(encabezados);
  filas.forEach((fila) => hoja.addRow(fila));
  const buffer = await libro.xlsx.writeBuffer();
  return Buffer.from(buffer).toString('base64');
}

/** Captura el detalle de la excepción de validación del archivo. */
async function erroresDe(promesa: Promise<unknown>): Promise<any[]> {
  try {
    await promesa;
  } catch (error) {
    expect(error).toBeInstanceOf(BadRequestException);
    return (error as BadRequestException).getResponse()['errores'];
  }
  throw new Error('Se esperaba un BadRequestException');
}

describe('CargueMasivoExternaService.validarArchivo', () => {
  let service: CargueMasivoExternaService;

  beforeEach(async () => {
    const modulo: TestingModule = await Test.createTestingModule({
      providers: [
        CargueMasivoExternaService,
        {
          provide: DominiosService,
          useValue: {
            getParametros: jest.fn().mockReturnValue(
              of({
                parametros: [
                  { Id: 7000, Nombre: '2024' },
                  { Id: 7001, Nombre: '2025' },
                ],
              }),
            ),
            getDependencias: jest.fn().mockReturnValue(
              of({
                parametros: [
                  { Id: 32, Nombre: 'Oficina de Control Interno' },
                  { Id: 45, Nombre: 'Secretaría General' },
                  { Id: 60, Nombre: 'Vicerrectoría Académica' },
                ],
              }),
            ),
          },
        },
      ],
    }).compile();

    service = modulo.get(CargueMasivoExternaService);
  });

  it('valida un archivo correcto y devuelve los hallazgos con nombres para la vista previa', async () => {
    const archivo = await crearArchivo([
      [
        '2025',
        'PAD-1',
        '3.1.2',
        'Deficiencias en la supervisión',
        'Oficina de Control Interno',
      ],
      [
        2024,
        'PAD-1',
        '3.1.3',
        'Falta de soportes',
        'Secretaría General|Vicerrectoría Académica',
      ],
    ]);

    const resultado = await service.validarArchivo(archivo);

    expect(resultado.total).toBe(2);
    expect(resultado.hallazgos[0]).toEqual({
      vigencia_pad: 7001,
      vigencia_nombre: '2025',
      codigo_auditoria_pad: 'PAD-1',
      numeral: '3.1.2',
      descripcion: 'Deficiencias en la supervisión',
      dependencia_id: [32],
      dependencias_nombre: ['Oficina de Control Interno'],
    });
    expect(resultado.hallazgos[1]).toMatchObject({
      vigencia_pad: 7000,
      dependencia_id: [45, 60],
      dependencias_nombre: ['Secretaría General', 'Vicerrectoría Académica'],
    });
  });

  it('acepta encabezados en otro orden, con mayúsculas y sin tildes', async () => {
    const archivo = await crearArchivo(
      [
        [
          'Oficina de Control Interno',
          'Falta de soportes',
          'PAD-9',
          '1',
          '2025',
        ],
      ],
      [
        'DEPENDENCIAS',
        'descripcion',
        'codigo de auditoria',
        'no. hallazgo',
        'vigencia',
      ],
    );

    const resultado = await service.validarArchivo(archivo);

    expect(resultado.hallazgos[0]).toMatchObject({
      codigo_auditoria_pad: 'PAD-9',
      numeral: '1',
      vigencia_pad: 7001,
      dependencia_id: [32],
    });
  });

  it('reconoce nombres de dependencia sin importar tildes, mayúsculas ni espacios', async () => {
    const archivo = await crearArchivo([
      ['2025', 'PAD-1', '1', 'Hallazgo', '  secretaria   GENERAL '],
    ]);

    const resultado = await service.validarArchivo(archivo);

    expect(resultado.hallazgos[0].dependencia_id).toEqual([45]);
  });

  it('omite las filas vacías y conserva el número de fila real en los errores', async () => {
    const archivo = await crearArchivo([
      ['2025', 'PAD-1', '1', 'Hallazgo uno', 'Oficina de Control Interno'],
      [],
      [
        '2025',
        'PAD-1',
        '',
        'Hallazgo sin número',
        'Oficina de Control Interno',
      ],
    ]);

    const errores = await erroresDe(service.validarArchivo(archivo));

    expect(errores).toEqual([
      {
        fila: 4,
        columna: 'No. Hallazgo',
        motivo: 'El número de hallazgo es obligatorio.',
      },
    ]);
  });

  it('reporta todos los errores del archivo con su columna y no devuelve hallazgos', async () => {
    const archivo = await crearArchivo([
      ['1999', 'PAD-1', '1', 'Hallazgo', 'Oficina de Control Interno'],
      ['2025', 'PAD-1', '2', 'Hallazgo', 'Dependencia Inventada'],
      ['2025', 'PAD-1', '2', 'Hallazgo repetido', 'Oficina de Control Interno'],
    ]);

    const errores = await erroresDe(service.validarArchivo(archivo));

    expect(errores).toEqual([
      { fila: 2, columna: 'Vigencia', motivo: 'La vigencia "1999" no existe.' },
      {
        fila: 3,
        columna: 'Dependencias',
        motivo: 'La dependencia "Dependencia Inventada" no es válida.',
      },
      {
        fila: 4,
        columna: 'No. Hallazgo',
        motivo: 'El hallazgo "2" de la auditoría "PAD-1" ya está en la fila 3.',
      },
    ]);
  });

  it('rechaza un archivo sin filas de datos', async () => {
    const errores = await erroresDe(
      service.validarArchivo(await crearArchivo([])),
    );

    expect(errores).toEqual([
      {
        fila: 0,
        columna: 'Archivo',
        motivo: 'Debe registrar al menos un hallazgo.',
      },
    ]);
  });

  it(`rechaza más de ${MAX_HALLAZGOS_EXTERNOS} hallazgos`, async () => {
    const filas = Array.from({ length: MAX_HALLAZGOS_EXTERNOS + 1 }, (_, i) => [
      '2025',
      'PAD-1',
      String(i),
      'Hallazgo',
      'Oficina de Control Interno',
    ]);

    const errores = await erroresDe(
      service.validarArchivo(await crearArchivo(filas)),
    );

    expect(errores).toHaveLength(1);
    expect(errores[0]).toMatchObject({ fila: 0, columna: 'Archivo' });
  });

  it('indica las columnas que faltan en el archivo', async () => {
    const archivo = await crearArchivo(
      [['2025', 'PAD-1']],
      ['Vigencia', 'Código de Auditoría'],
    );

    await expect(service.validarArchivo(archivo)).rejects.toThrow(
      'Al archivo le faltan las columnas: No. Hallazgo, Descripción, Dependencias.',
    );
  });

  it('rechaza un archivo que no es un xlsx', async () => {
    const noExcel = Buffer.from('esto no es un excel').toString('base64');

    await expect(service.validarArchivo(noExcel)).rejects.toThrow(
      'El archivo no es un Excel (.xlsx) válido.',
    );
  });

  it('rechaza una entrada vacía o demasiado grande', async () => {
    await expect(service.validarArchivo('')).rejects.toThrow(
      'El archivo es obligatorio.',
    );
    await expect(
      service.validarArchivo(undefined as unknown as string),
    ).rejects.toThrow('El archivo es obligatorio.');
    await expect(service.validarArchivo('A'.repeat(8_000_000))).rejects.toThrow(
      'supera el tamaño máximo de 5 MB',
    );
  });
});
