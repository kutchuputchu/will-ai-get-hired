declare module "pdf-parse" {
  const pdfParse: (data: Buffer | Uint8Array) => Promise<{
    text: string;
    numpages: number;
    info: any;
  }>;
  export default pdfParse;
}