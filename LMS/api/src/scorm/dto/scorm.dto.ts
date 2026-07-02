export class RequestScormUploadDto {
  title?: string;
  fileName?: string;
  mimeType?: string;
}

export class ConfirmScormUploadDto {
  lessonId?: string;
}

export class SaveRuntimeDataDto {
  cmiData?: Record<string, unknown>;
  suspendData?: string;
  location?: string;
  score?: number;
  status?: string;
  totalTime?: string;
}
