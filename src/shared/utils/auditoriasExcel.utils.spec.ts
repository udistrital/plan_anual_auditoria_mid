import ExcelJS from 'exceljs';
import { setupValidationDomains } from './auditoriasExcel.utils';

/** Plantilla como la de auditorías: encabezados en la fila 1 y hoja `origen` con títulos en la fila 2. */
async function crearPlantilla(encabezados: string[], titulosOrigen: string[]) {
  const libro = new ExcelJS.Workbook();
  const datos = libro.addWorksheet('datos');
  datos.getRow(1).values = encabezados;
  // Como la plantilla real: filas de datos vacías pero con formato (solo así existen las celdas)
  for (let fila = 2; fila <= 110; fila++) {
    encabezados.forEach((_, col) => {
      datos.getRow(fila).getCell(col + 1).border = {
        bottom: { style: 'thin' },
      };
    });
  }
  const origen = libro.addWorksheet('origen');
  titulosOrigen.forEach((titulo, i) => {
    origen.getRow(2).getCell(i + 2).value = titulo;
  });
  return (await libro.xlsx.writeBuffer()) as ArrayBuffer;
}

async function releer(buffer: ArrayBuffer) {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(buffer);
  return libro;
}

describe('setupValidationDomains', () => {
  describe('sin opciones (plantilla de auditorías)', () => {
    it('usa los encabezados de auditorías y valida hasta la fila 35', async () => {
      const entrada = await crearPlantilla(
        [
          'ID',
          'Auditoria',
          'Tipo de Evaluación',
          'Macroproceso',
          'Proceso',
          'Dependencia',
        ],
        ['Dependencia'],
      );

      const salida = await setupValidationDomains(
        { Dependencia: ['OCI', 'Planeación'] },
        [{ sheetIndex: 0 }],
        entrada,
      );

      const hoja = (await releer(salida)).worksheets[0];
      // "Dependencia" es la columna 6 (F)
      expect(hoja.getCell('F2').dataValidation).toEqual(
        expect.objectContaining({
          type: 'list',
          formulae: ['origen!$B$3:$B$4'],
        }),
      );
      expect(hoja.getCell('F35').dataValidation?.type).toBe('list');
      expect(hoja.getCell('F36').dataValidation).toBeFalsy();
    });
  });

  describe('con opciones (otra plantilla)', () => {
    it('ubica la columna por los encabezados indicados', async () => {
      const entrada = await crearPlantilla(['Uno', 'Dos', 'Tres'], ['Tres']);

      const salida = await setupValidationDomains(
        { Tres: ['a', 'b'] },
        [{ sheetIndex: 0 }],
        entrada,
        { headers: ['Uno', 'Dos', 'Tres'] },
      );

      const hoja = (await releer(salida)).worksheets[0];
      expect(hoja.getCell('C2').dataValidation?.type).toBe('list');
      expect(hoja.getCell('A2').dataValidation).toBeFalsy();
    });

    it('aplica la validación hasta las filas pedidas con `length`', async () => {
      const entrada = await crearPlantilla(['Uno'], ['Uno']);

      const salida = await setupValidationDomains(
        { Uno: ['a'] },
        [{ sheetIndex: 0, length: 100 }],
        entrada,
        { headers: ['Uno'] },
      );

      const hoja = (await releer(salida)).worksheets[0];
      expect(hoja.getCell('A101').dataValidation?.type).toBe('list');
      expect(hoja.getCell('A102').dataValidation).toBeFalsy();
    });

    it('escribe las listas sin validar los encabezados marcados como sin validación', async () => {
      const entrada = await crearPlantilla(['Uno', 'Dos'], ['Uno', 'Dos']);

      const salida = await setupValidationDomains(
        { Uno: ['a'], Dos: ['x', 'y'] },
        [{ sheetIndex: 0 }],
        entrada,
        { headers: ['Uno', 'Dos'], sinValidacion: ['Dos'] },
      );

      const libro = await releer(salida);
      expect(libro.worksheets[0].getCell('A2').dataValidation?.type).toBe(
        'list',
      );
      expect(libro.worksheets[0].getCell('B2').dataValidation).toBeFalsy();
      const origen = libro.getWorksheet('origen')!;
      expect(origen.getCell('C3').value).toBe('x');
      expect(origen.getCell('C4').value).toBe('y');
    });
  });
});
