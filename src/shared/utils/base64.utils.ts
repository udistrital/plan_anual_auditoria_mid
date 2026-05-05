/**
 * Converts a Base64 string to an ArrayBuffer.
 * @param base64 The Base64 encoded string representing the file data.
 * @returns An ArrayBuffer representing the binary content of the file.
 * @throws If any issue occurs during the process of converting the Base64 string to an ArrayBuffer.
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  try {
    const buffer = Buffer.from(base64, 'base64');
    return buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    );
  } catch (error) {
    const newError = new Error(
      'Failed to convert Base64 string to ArrayBuffer',
    );
    newError.stack += '\nCaused by: ' + error.stack;
    throw newError;
  }
}

/**
 * Converts an ArrayBuffer to a Base64 string.
 * @param buffer The ArrayBuffer containing the binary data to be converted to Base64.
 * @returns A Base64 encoded string representing the binary content of the ArrayBuffer.
 * @throws If any issue occurs during the process of converting the ArrayBuffer to a Base64 string.
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  try {
    const bytes = new Uint8Array(buffer);
    let binaryString = '';
    for (let i = 0; i < bytes.byteLength; i++)
      binaryString += String.fromCharCode(bytes[i]);

    return Buffer.from(binaryString, 'binary').toString('base64');
  } catch (error) {
    const newError = new Error(
      'Failed to convert ArrayBuffer to Base64 string',
    );
    newError.stack += '\nCaused by: ' + error.stack;
    throw newError;
  }
}
