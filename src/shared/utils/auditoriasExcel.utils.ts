/** The ExcelJS library for handling Excel files */
const ExcelJS = require('exceljs');


/** Index of the row where the data starts in the Excel template (1-based index) */
const dataSheetStartRowIndex = 2;    // because row 1 has the header titles
/** The maximum number of rows in the original template before we need to start adding new rows */
const dataSheetOriginalMaxRows = 35; // the template goes up to row 36

/** The name of the sheet in the Excel template where the validation domains are stored */
const domainSheetName = 'origen';
/** The column offset in the domain sheet where the valid options start (1-based index) */
const domainSheetColumnOffset = 2;   // because A is empty
/** The row offset in the domain sheet where the valid options start (1-based index) */
const domainSheetRowOffset = 3;      // because row 1 is empty and row 2 has the header titles


/** Array of month abbreviations used in the Excel file */
const MESES_ARCHIVO =
    ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/** Headers for the Excel file */
const HEADERS = [
  'ID', 'Auditoria', 'Tipo de Evaluación',
  'Macroproceso', 'Proceso', 'Dependencia',
  ...MESES_ARCHIVO
];

/**
 * Configures the validation domains in the Excel template based on the provided valid options for each header. 
 * @param headersValidacion An object mapping header names to arrays of valid values for data validation.
 * @param rowsLengths An array of objects specifying the length of data rows for each sheet index, used to determine how many rows to apply validation to.
 * @param inputBuffer An ArrayBuffer containing the Excel template file data.
 * @returns A Promise that resolves to an ArrayBuffer containing the Excel file data with configured validation domains.
 * @throws If any issue occurs during the process of configuring validation domains in the Excel file.
 */
export async function setupValidationDomains(
    headersValidacion: { [header: string]: string[] },
    rowsLengths: { sheetIndex: number, length?: number }[],
    inputBuffer: ArrayBuffer,
): Promise<ArrayBuffer>
{
  try {
    // Load the template workbook from the Base64 string and select the first worksheet
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(inputBuffer);
    console.debug('headersValidacion in descargarAuditorias:', headersValidacion);

    // TODO: Temporarily remove empty string values from test environment
    Object.keys(headersValidacion).forEach(header => {
      headersValidacion[header] =
          headersValidacion[header].filter(value => value !== '');
    });

    // Calculate the maximum length of the validation domains to determine how many rows to fill in the 'origen' sheet
    let maxDomainLength = 0;
    Object.keys(headersValidacion).forEach(header => {
      const domainLength = headersValidacion[header].length;
      if (domainLength > maxDomainLength)
        maxDomainLength = domainLength;
    });

    // Update the domain sheet with the valid options for each header that requires validation
    const domainSheet = workbook.getWorksheet(domainSheetName);
    
    for (let i = domainSheetRowOffset; i <= maxDomainLength + domainSheetRowOffset; i++) {
      const currentRow = domainSheet.getRow(i);
      Object.keys(headersValidacion).forEach((header, index) => {
        const headerColIdx =  index + domainSheetColumnOffset;
        const currentCell = currentRow.getCell(headerColIdx);
        currentCell.value = headersValidacion[header][i - domainSheetRowOffset] ?? '';
      });
      currentRow.commit();
    }

    // Calculate the range of valid options for each header to be used in data validation
    let validationRanges: { 
      [header: string]: {
        colIdx: number;
        fromRowIdx: number;
        toRowIdx: number;
      }
    } = {};

    Object.keys(headersValidacion).forEach((header, index) => {
      validationRanges[header] = {
        colIdx: index + domainSheetColumnOffset,
        fromRowIdx: domainSheetRowOffset,
        toRowIdx: headersValidacion[header].length - 1 + domainSheetRowOffset,
      };
    });


    // Add back data validation for each header that requires it, applying to all rows up to maxRowIndex
    rowsLengths.forEach(sheetInfo => {
      const worksheet = workbook.worksheets[sheetInfo.sheetIndex];
      const rowsLength = sheetInfo.length;

      const maxRowIndex = rowsLength == null ? dataSheetOriginalMaxRows :
                          Math.max(dataSheetOriginalMaxRows, dataSheetStartRowIndex + rowsLength - 1);

      Object.keys(headersValidacion).forEach(header => {
        const headerColIdx = HEADERS.indexOf(header) + 1;
        const originColumnLetter = String.fromCharCode(64 + validationRanges[header].colIdx);
        const originFirstRow = validationRanges[header].fromRowIdx;
        const originLastRow = validationRanges[header].toRowIdx;
        const formulae = `origen!$${originColumnLetter}$${originFirstRow}:$${originColumnLetter}$${originLastRow}`;

        try {
          worksheet
            .getColumn(headerColIdx)
            .eachCell({ includeEmpty: true }, (cell: any, rowNumber: number) => {
              if (rowNumber >= dataSheetStartRowIndex && rowNumber <= maxRowIndex) {
                cell.dataValidation = {
                  type: 'list',
                  allowBlank: true,
                  formulae: [formulae],
                  showErrorMessage: true,
                  errorStyle: 'error',
                }
              };
            });
        } catch (error) {
          console.warn(`Error applying data validation for header "${header}":`, error);
        }
      });
    });

    return await workbook.xlsx.writeBuffer();
  }
  catch (error) {
    const newError = new Error('Error al configurar los dominios de validación en la plantilla de Excel.');
    newError.stack += "\nCaused by: " + (error instanceof Error ? error.stack : String(error));
    throw newError;
  }
}
