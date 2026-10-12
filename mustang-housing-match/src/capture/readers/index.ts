export interface RawCapture {
  url: string;
  title: string;
  source: "unsupported";
}

export function capturePage(doc: Document, url: string): RawCapture {
  return { url, title: doc.title, source: "unsupported" };
}
