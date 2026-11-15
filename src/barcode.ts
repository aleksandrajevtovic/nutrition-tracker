// Keep leading zeroes: a UPC and its zero-padded EAN/GTIN identify the same product.
export const cleanBarcode = (value: string) => value.replace(/[\s-]/g, '');
export function validBarcode(value: unknown): value is string {
  if (typeof value !== 'string' || !/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(value)) return false;
  const digits = [...value].map(Number);
  const sum = digits.slice(0, -1).reverse().reduce((sum, digit, index) => sum + digit * (index % 2 ? 1 : 3), 0);
  return (10 - sum % 10) % 10 === digits.at(-1);
}
export const barcodeKey = (value: string) => cleanBarcode(value).padStart(14, '0');
