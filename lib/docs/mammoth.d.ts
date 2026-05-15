// Type stub for the browser entry of mammoth (the package itself ships
// types only for its Node entry, not for mammoth.browser.js).
declare module "mammoth/mammoth.browser" {
  export function convertToHtml(input: {
    arrayBuffer: ArrayBuffer;
  }): Promise<{
    value: string;
    messages: { type: string; message: string }[];
  }>;
}
