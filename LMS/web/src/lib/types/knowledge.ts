export interface DocumentCategory {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  parentId: string | null;
  description: string | null;
  _count?: { documents: number; children: number };
}

export interface Document {
  id: string;
  tenantId: string;
  categoryId: string | null;
  title: string;
  description: string | null;
  type: string;
  fileObjectKey: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  version: number;
  uploadedById: string;
  status: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  category?: { id: string; name: string } | null;
  uploadedBy?: { id: string; firstName: string | null; lastName: string | null; email: string };
  versions?: DocumentVersion[];
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  versionNumber: number;
  fileObjectKey: string;
  fileName: string;
  fileSize: number;
  uploadedById: string;
  changeNote: string | null;
  createdAt: string;
  uploadedBy?: { id: string; firstName: string | null; lastName: string | null };
}

export interface DocumentListResponse {
  items: Document[];
  total: number;
  page: number;
  limit: number;
}
