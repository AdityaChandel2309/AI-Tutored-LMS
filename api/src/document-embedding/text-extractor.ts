import { Logger } from '@nestjs/common';

const logger = new Logger('DocumentTextExtractor');

const MAX_EXTRACT_BYTES = 25 * 1024 * 1024; // 25 MB safety cap

/**
 * Extract plain text from a document buffer based on MIME type.
 *
 * Supports:
 *  - application/pdf                       → pdf-parse
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
      // Lazy import so cold-start / test paths that never touch PDFs
      // don't pay the pdf-parse initialization cost.
      const mod = (await import('pdf-parse')) as unknown as {
        default?: (b: Buffer) => Promise<{ text: string }>;
      };
      const parse = mod.default ?? (mod as unknown as (b: Buffer) => Promise<{ text: string }>);
      const result = await parse(buffer);
      return normalize(result?.text ?? '');
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