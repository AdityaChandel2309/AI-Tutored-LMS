import { Logger } from '@nestjs/common';

const logger = new Logger('DocumentTextExtractor');

const MAX_EXTRACT_BYTES = 25 * 1024 * 1024; // 25 MB safety cap
const MIN_NATIVE_PDF_CHARS = 500;
const MIN_NATIVE_PDF_LETTERS = 100;

/**
 * Extract plain text from a document buffer based on MIME type.
 *
 * Supports:
 *  - application/pdf                       → pdf-parse, with optional Gemini OCR fallback for scanned PDFs
 *  - text/plain, text/markdown, text/html  → UTF-8 decode (HTML stripped)
 *  - application/json                      → UTF-8 decode
 *
 * Office docs (.docx/.xlsx/.pptx) and legacy binary formats return null;
 * those documents fall back to metadata-only embedding until a richer
 * extractor (e.g. `mammoth`, `xlsx`) is wired in.
 *
 * Never throws — a failed extraction returns null so upload/backfill
 * flows can continue with metadata-only indexing.
 */
export async function extractDocumentText(
  buffer: Buffer,
  mimeType: string | null | undefined,
): Promise<string | null> {
  if (!buffer || buffer.length === 0) return null;
  if (buffer.length > MAX_EXTRACT_BYTES) {
    logger.warn(
      `Skipping extraction: buffer ${buffer.length} bytes exceeds ${MAX_EXTRACT_BYTES}`,
    );
    return null;
  }

  const mime = (mimeType ?? '').toLowerCase();

  try {
    if (mime === 'application/pdf') {
      const nativeText = await extractPdfNativeText(buffer);
      if (hasMeaningfulPdfText(nativeText)) return nativeText;

      // Scanned/image PDFs often produce little or no native text. If a
      // server-side Gemini key is configured, OCR the PDF so the assistant can
      // answer from the actual document body instead of only metadata.
      const ocrText = await extractPdfWithGeminiOcr(buffer);
      return ocrText ?? nativeText;
    }

    if (
      mime.startsWith('text/') ||
      mime === 'application/json' ||
      mime === 'application/xml'
    ) {
      const raw = buffer.toString('utf8');
      if (mime === 'text/html') return normalize(stripHtml(raw));
      return normalize(raw);
    }

    // Office formats and binary blobs: extraction not yet supported.
    return null;
  } catch (err) {
    logger.warn(
      `Text extraction failed for MIME "${mime}": ${(err as Error).message}`,
    );
    return null;
  }
}

async function extractPdfNativeText(buffer: Buffer): Promise<string | null> {
  // Lazy import so cold-start / test paths that never touch PDFs don't pay the
  // parser cost. pdf-parse v2 exports `PDFParse`; older v1 exported a default
  // callable. Support both so deployments are resilient to package shape.
  const mod = (await import('pdf-parse')) as unknown as {
    PDFParse?: new (input: { data: Buffer }) => {
      getText: () => Promise<{ text?: string }>;
      destroy?: () => Promise<void> | void;
    };
    default?: (b: Buffer) => Promise<{ text?: string }>;
  };

  if (typeof mod.PDFParse === 'function') {
    const parser = new mod.PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return normalize(result?.text ?? '');
    } finally {
      await parser.destroy?.();
    }
  }

  if (typeof mod.default === 'function') {
    const result = await mod.default(buffer);
    return normalize(result?.text ?? '');
  }

  throw new Error('Unsupported pdf-parse export shape');
}

function hasMeaningfulPdfText(text: string | null): text is string {
  if (!text) return false;
  const letters = text.replace(/[^a-z]/gi, '').length;
  return text.length >= MIN_NATIVE_PDF_CHARS && letters >= MIN_NATIVE_PDF_LETTERS;
}

async function extractPdfWithGeminiOcr(buffer: Buffer): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: 'Extract all readable text from this PDF. Return only the extracted document text, preserving headings and lists where possible.',
                },
                {
                  inline_data: {
                    mime_type: 'application/pdf',
                    data: buffer.toString('base64'),
                  },
                },
              ],
            },
          ],
        }),
      },
    );

    if (!response.ok) {
      logger.warn(`Gemini OCR returned ${response.status}`);
      return null;
    }

    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? '')
      .join('\n');
    return normalize(text ?? '');
  } catch (err) {
    logger.warn(`Gemini OCR failed: ${(err as Error).message}`);
    return null;
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
}

function normalize(text: string): string | null {
  const trimmed = text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return trimmed.length > 0 ? trimmed : null;
}