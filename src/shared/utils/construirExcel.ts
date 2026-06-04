import ExcelJS from 'exceljs';

/** Maximum column width in characters */
const MAX_COLUMN_WIDTH = 40;

/**
 * Interface representing the structure of the data required to construct an Excel file,
 * including an array of worksheets, where each worksheet has a name and an array of rows,
 * and each row is an array of strings representing cell values.
 */
export interface ConstruirExcelInterface {
  worksheets: [{
    name: string;
    rows: Array<Array<string>>;
  }]
}

/**
 * Constructs an Excel file from the given tabular data and returns it as an ArrayBuffer.
 * @param data An object containing the tabular data to be included in the Excel file, structured as an array of worksheets, where each worksheet has a name and an array of rows, and each row is an array of strings representing cell values.
 * @returns A promise that resolves with the constructed Excel file as an ArrayBuffer.
 * @throws An error if the construction process fails, with a message indicating the failure and the original error stack trace.
 */
export async function construirExcel(data: ConstruirExcelInterface): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();

  // Iterate over each worksheet in the input data and construct it in the workbook
  for (const worksheet of data.worksheets) {
    try {
      await construirHojaExcel(workbook, worksheet.name, worksheet.rows);
    } catch (error) {
      console.error(`Error al construir la hoja "${worksheet.name}":`, error);
      throw new Error(`Error al construir la hoja "${worksheet.name}": ${error}`);
    }
  }

  // Clear any default themes to avoid issues with styling in the generated Excel file
  workbook.clearThemes();
  return await workbook.xlsx.writeBuffer();
}



/**
 * Constructs an Excel worksheet with the given name and rows of data, and adds it to the provided workbook.
 * @param workbook The ExcelJS workbook to which the new worksheet will be added.
 * @param name The name of the worksheet to be created.
 * @param rows An array of arrays of strings representing the tabular data to be inserted into the worksheet, where each inner array corresponds to a row and each string corresponds to a cell value.
 * @returns A promise that resolves when the worksheet has been successfully constructed and added to the workbook.
 * @throws An error if the construction process fails, with a message indicating the failure and the original error stack trace.
 */
async function construirHojaExcel(workbook: ExcelJS.Workbook, name: string, rows: Array<Array<string>>): Promise<void> {
  const worksheet = workbook.addWorksheet(name);
  const rowCount = rows.length;
  let columnCount = 0;
  const columnWidths: { [key: number]: number } = {};

  // Show a preview of the rows in the console for debugging
  console.debug(
    `Construyendo hoja "${name}" con filas (primeras tres):`,
    rows.slice(0, 3),
  )

  // Insert the data into the worksheet
  rows.forEach((rowData, rowIndex) => {
    // Update columnCount if the current row has more columns than the previous maximum
    if (rowData.length > columnCount)
      columnCount = rowData.length;

    const sheetRow = worksheet.getRow(rowIndex + 1);
    rowData.forEach((cellData, columnIndex) => {
      // Set the cell value in the worksheet
      sheetRow.getCell(columnIndex + 1).value = cellData;

      // Update the width of the current column based on the length of the cell data, ensuring it does not exceed the maximum column width
      const cellDataWidth = cellData ? cellData.toString().length : 0;
      columnWidths[columnIndex] = Math.min(
        Math.max(columnWidths[columnIndex] || 0, cellDataWidth),
        MAX_COLUMN_WIDTH
      );
    });
  });

  // Set the column widths based on the calculated maximums
  for (let i = 0; i < columnCount; i++) {
    worksheet.getColumn(i + 1).width = columnWidths[i] + 2; // Add some padding to the column width
  }

  // Apply bold font and center alignment to the header row (first row) of the worksheet
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

  // Create a grid border style using the rowCount and columnCount give the cells top-left alignment with wrapping
  const borderStyle = {
    top: { style: 'thin' as const },
    left: { style: 'thin' as const },
    bottom: { style: 'thin' as const },
    right: { style: 'thin' as const },
  };
  for (let i = 1; i <= rowCount; i++) {
    const sheetRow = worksheet.getRow(i);
    for (let j = 1; j <= columnCount; j++) {
      const cell = sheetRow.getCell(j);
      cell.border = { ...cell.border, ...borderStyle };
      cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
    }
  }
}
