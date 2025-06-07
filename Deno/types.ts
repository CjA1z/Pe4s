export interface FileResponse {
  success?: boolean;
  filePath?: string;
  fileName?: string;
  message?: string;
  isPartial?: boolean;
  documentType?: string;
  size?: number;
  fileId?: string;
} 