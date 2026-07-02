import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import * as path from 'path';

export interface FileValidationOptions {
  maxSizeBytes: number;
  allowedMimeTypes: string[];
  allowedExtensions?: string[];
}

const DOCUMENT_OPTS: FileValidationOptions = {
  maxSizeBytes: 50 * 1024 * 1024, // 50MB
  allowedMimeTypes: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
  ],
  allowedExtensions: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv'],
};

const CSV_OPTS: FileValidationOptions = {
  maxSizeBytes: 10 * 1024 * 1024, // 10MB
  allowedMimeTypes: ['text/csv', 'application/vnd.ms-excel', 'text/plain'],
  allowedExtensions: ['.csv'],
};

const VIDEO_MIME_TYPES = [
  'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo',
];

const SCORM_MIME_TYPES = [
  'application/zip', 'application/x-zip-compressed', 'application/octet-stream',
];

@Injectable()
export class FileValidationPipe implements PipeTransform {
  constructor(private readonly options: FileValidationOptions) {}

  transform(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    if (file.size > this.options.maxSizeBytes) {
      const maxMB = Math.round(this.options.maxSizeBytes / (1024 * 1024));
      throw new BadRequestException(`File exceeds maximum size of ${maxMB}MB`);
    }

    if (!this.options.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type "${file.mimetype}" is not allowed. Allowed: ${this.options.allowedMimeTypes.join(', ')}`,
      );
    }

    if (this.options.allowedExtensions && file.originalname) {
      const ext = path.extname(file.originalname).toLowerCase();
      if (!this.options.allowedExtensions.includes(ext)) {
        throw new BadRequestException(
          `File extension "${ext}" is not allowed. Allowed: ${this.options.allowedExtensions.join(', ')}`,
        );
      }
    }

    return file;
  }
}

// Pre-configured instances
export const DocumentFileValidation = new FileValidationPipe(DOCUMENT_OPTS);
export const CsvFileValidation = new FileValidationPipe(CSV_OPTS);

// Validation for presigned-URL flows (validates the requested mimeType string)
export function validateUploadMimeType(mimeType: string, allowed: string[]): void {
  if (!allowed.includes(mimeType)) {
    throw new BadRequestException(
      `MIME type "${mimeType}" is not allowed. Allowed: ${allowed.join(', ')}`,
    );
  }
}

export { VIDEO_MIME_TYPES, SCORM_MIME_TYPES };
