// Pre-upload service for handling file preparation before upload
import { ensureDir } from "../deps.ts";

interface FormDataFile {
  name?: string;
  filename?: string;
  content?: Uint8Array;
  contentType?: string;
  size?: number;
}

interface PreUploadResult {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  preview?: string;
  metadata?: Record<string, unknown>;
  validationErrors?: string[];
}

interface PreUploadOptions {
  maxFileSize?: number;
  allowedTypes?: string[];
  generatePreview?: boolean;
  extractMetadata?: boolean;
}

const DEFAULT_OPTIONS: PreUploadOptions = {
  maxFileSize: 500 * 1024 * 1024, // 500MB
  allowedTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/rtf'],
  generatePreview: true,
  extractMetadata: true
};

export class PreUploadManager {
  private static instance: PreUploadManager;
  private tempDir: string;
  private preparedFiles: Map<string, PreUploadResult>;

  private constructor(tempDir = "temp/pre-upload") {
    this.tempDir = tempDir;
    this.preparedFiles = new Map();
    this.loadPreparedFiles().catch(console.error);
  }

  public static getInstance(tempDir = "temp/pre-upload"): PreUploadManager {
    if (!PreUploadManager.instance) {
      PreUploadManager.instance = new PreUploadManager(tempDir);
    }
    return PreUploadManager.instance;
  }

  private async loadPreparedFiles(): Promise<void> {
    try {
      await ensureDir(this.tempDir);
      
      // Read all files in temp directory
      for await (const entry of Deno.readDir(this.tempDir)) {
        if (entry.isFile) {
          try {
            // Try to read metadata file if it exists
            const metadataPath = `${this.tempDir}/${entry.name}.meta.json`;
            const fileInfo = await Deno.stat(`${this.tempDir}/${entry.name}`);
            
            let metadata: PreUploadResult | undefined;
            try {
              const metadataContent = await Deno.readTextFile(metadataPath);
              metadata = JSON.parse(metadataContent);
            } catch {
              // If metadata file doesn't exist or is invalid, create basic metadata
              metadata = {
                id: entry.name,
                fileName: entry.name,
                fileSize: fileInfo.size,
                fileType: 'application/octet-stream'
              };
            }
            
            if (metadata) {
              this.preparedFiles.set(entry.name, metadata);
            }
          } catch (error) {
            console.warn(`Failed to load prepared file ${entry.name}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load prepared files:', error);
    }
  }

  private async savePreparedFileMetadata(fileId: string, metadata: PreUploadResult): Promise<void> {
    try {
      const metadataPath = `${this.tempDir}/${fileId}.meta.json`;
      await Deno.writeTextFile(metadataPath, JSON.stringify(metadata, null, 2));
    } catch (error) {
      console.error(`Failed to save metadata for file ${fileId}:`, error);
    }
  }

  /**
   * Prepare a file for upload by validating and processing it
   */
  async prepareFile(file: FormDataFile, options: PreUploadOptions = {}): Promise<PreUploadResult> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const fileId = crypto.randomUUID();
    
    // Basic validation
    const validationErrors: string[] = [];
    
    if (file.size && file.size > (opts.maxFileSize || DEFAULT_OPTIONS.maxFileSize!)) {
      validationErrors.push(`File size ${file.size} exceeds maximum allowed size of ${opts.maxFileSize} bytes`);
    }
    
    if (opts.allowedTypes && file.contentType && !opts.allowedTypes.includes(file.contentType)) {
      validationErrors.push(`File type ${file.contentType} is not allowed. Allowed types: ${opts.allowedTypes.join(', ')}`);
    }

    // Create result object
    const result: PreUploadResult = {
      id: fileId,
      fileName: file.filename || file.name || 'unnamed_file',
      fileSize: file.size || 0,
      fileType: file.contentType || 'application/octet-stream',
      validationErrors: validationErrors.length > 0 ? validationErrors : undefined
    };

    // If file is valid, process it
    if (validationErrors.length === 0) {
      try {
        // Ensure temp directory exists
        await ensureDir(this.tempDir);
        
        // Store file in temp directory
        const tempPath = `${this.tempDir}/${fileId}`;
        if (file.content) {
          await Deno.writeFile(tempPath, file.content);
          
          // Save metadata to filesystem
          await this.savePreparedFileMetadata(fileId, result);
        }

        // Generate preview if requested
        if (opts.generatePreview) {
          result.preview = await this.generatePreview(file);
        }

        // Extract metadata if requested
        if (opts.extractMetadata) {
          result.metadata = await this.extractMetadata(file);
        }

        // Store the prepared file info
        this.preparedFiles.set(fileId, result);
      } catch (error: unknown) {
        console.error('Error preparing file:', error);
        validationErrors.push(`Error preparing file: ${error instanceof Error ? error.message : String(error)}`);
        result.validationErrors = validationErrors;
      }
    }

    return result;
  }

  /**
   * Generate a preview of the file (e.g., first page of PDF, image thumbnail)
   */
  private async generatePreview(file: FormDataFile): Promise<string | undefined> {
    // For now, return undefined as preview generation depends on file type
    // and requires additional libraries
    return undefined;
  }

  /**
   * Extract metadata from the file
   */
  private async extractMetadata(file: FormDataFile): Promise<Record<string, unknown>> {
    const metadata: Record<string, unknown> = {
      size: file.size || 0,
      type: file.contentType || 'application/octet-stream',
      name: file.filename || file.name || 'unnamed_file'
    };

    return metadata;
  }

  /**
   * Get a prepared file by its ID
   */
  getPreparedFile(fileId: string): PreUploadResult | undefined {
    // First try memory
    let result = this.preparedFiles.get(fileId);
    
    // If not in memory, try to load from filesystem
    if (!result) {
      try {
        const metadataPath = `${this.tempDir}/${fileId}.meta.json`;
        const metadataContent = Deno.readTextFileSync(metadataPath);
        result = JSON.parse(metadataContent);
        if (result) {
          this.preparedFiles.set(fileId, result);
        }
      } catch {
        // If metadata file doesn't exist or is invalid, check if the file exists
        try {
          const fileInfo = Deno.statSync(`${this.tempDir}/${fileId}`);
          if (fileInfo.isFile) {
            result = {
              id: fileId,
              fileName: fileId,
              fileSize: fileInfo.size,
              fileType: 'application/octet-stream'
            };
            this.preparedFiles.set(fileId, result);
          }
        } catch {
          // File doesn't exist
          return undefined;
        }
      }
    }
    
    return result;
  }

  /**
   * Clean up temporary files
   */
  async cleanup(fileId?: string): Promise<void> {
    try {
      if (fileId) {
        // Clean up specific file
        const filePath = `${this.tempDir}/${fileId}`;
        const metadataPath = `${this.tempDir}/${fileId}.meta.json`;
        
        try {
          await Deno.remove(filePath);
        } catch {
          // Ignore if file doesn't exist
        }
        
        try {
          await Deno.remove(metadataPath);
        } catch {
          // Ignore if metadata doesn't exist
        }
        
        this.preparedFiles.delete(fileId);
      } else {
        // Clean up all files
        await Deno.remove(this.tempDir, { recursive: true });
        this.preparedFiles.clear();
      }
    } catch {
      // Ignore errors if files don't exist
    }
  }
} 