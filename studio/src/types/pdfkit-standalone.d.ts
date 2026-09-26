/**
 * PDFKit's standalone browser bundle ships no type declarations of its own.
 *
 * We use this build rather than the package's default entry point because the
 * Node build imports `fs`, which cannot resolve in a browser bundle. The real
 * surface we rely on is described by `PdfDoc` in src/lib/sheets/pdf-sheet.ts,
 * which is what the sheet engine is written against — this declaration exists
 * only to let the import itself typecheck.
 */
declare module "pdfkit/js/pdfkit.standalone.js" {
  const PDFDocument: new (options: Record<string, unknown>) => unknown;
  export default PDFDocument;
}
