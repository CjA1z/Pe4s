import { ensureDir, join } from "../deps.ts";
import { FileResponse } from "../types.ts";

interface ChunkInfo {
  chunkIndex: number;
  totalChunks: number;
  fileName: string;
}

class ChunkedUploadManager {
  private tempDir: string;
  private uploadDir: string;
  private activeUploads: Map<string, { documentType: string; tempDir: string }>;

  constructor(tempDir = "storage/temp", uploadDir = "storage") {
    this.tempDir = tempDir;
    this.uploadDir = uploadDir;
    this.activeUploads = new Map();
  }

  async handleChunk(chunk: Uint8Array, chunkInfo: ChunkInfo & { document_type?: string }): Promise<FileResponse> {
    const { chunkIndex, totalChunks, fileName } = chunkInfo;
    
    // Create temp directory if it doesn't exist
    await ensureDir(this.tempDir);

    // Generate or retrieve file ID
    const fileId = this.getFileId(fileName, totalChunks);
    
    // Determine document type
    let documentType = "HELLO";
    if (chunkIndex === 0) {
      // For first chunk, store the document type
      documentType = this.normalizeDocumentType(chunkInfo.document_type);
      const fileTempDir = join(this.tempDir, fileId);
      this.activeUploads.set(fileId, { documentType, tempDir: fileTempDir });
    } else {
      // For subsequent chunks, retrieve stored document type
      const upload = this.activeUploads.get(fileId);
      documentType = upload?.documentType || "HELLO";
    }

    // Determine the correct storage path based on document type
    const storagePath = `storage/${documentType.toLowerCase()}`;
    await ensureDir(storagePath);

    // Create a temporary directory for this file's chunks
    const fileTempDir = join(this.tempDir, fileId);
    await ensureDir(fileTempDir);

    // Save the chunk
    const chunkPath = join(fileTempDir, `chunk_${chunkIndex}`);
    await Deno.writeFile(chunkPath, chunk);

    // If this is the last chunk, combine all chunks
    if (chunkIndex === totalChunks - 1) {
      // Combine all chunks
      const finalFilePath = join(storagePath, fileName);
      
      // Create a new array to hold all the chunks
      let combinedData = new Uint8Array();
      
      // Read and combine all chunks
      for (let i = 0; i < totalChunks; i++) {
        const chunkPath = join(fileTempDir, `chunk_${i}`);
        const chunkData = await Deno.readFile(chunkPath);
        
        // Create a new array with space for both existing data and new chunk
        const newData = new Uint8Array(combinedData.length + chunkData.length);
        newData.set(combinedData);
        newData.set(chunkData, combinedData.length);
        combinedData = newData;
      }

      // Write the combined data to the final file
      await Deno.writeFile(finalFilePath, combinedData);

      // Clean up temp directory and active upload record
      await this.cleanup(fileId);

      // Return the path relative to workspace root
      const workspaceRoot = Deno.cwd().replace(/[\\/]Deno$/, '');
      const relativePath = finalFilePath.substring(workspaceRoot.length).replace(/^[\\/]+/, '');

      return {
        success: true,
        filePath: relativePath,
        fileName: fileName,
        message: "File upload complete",
        documentType: documentType,
        fileId: fileId
      };
    }

    return {
      success: true,
      message: "Chunk received",
      isPartial: true,
      documentType: documentType,
      fileId: fileId
    };
  }

  private normalizeDocumentType(documentType?: string): string {
    const validTypes = ["THESIS", "DISSERTATION", "CONFLUENCE", "SYNERGY"];
    const normalizedType = (documentType || "").toUpperCase();
    return validTypes.includes(normalizedType) ? normalizedType : "HELLO";
  }

  private getFileId(fileName: string, totalChunks: number): string {
    // Create a unique ID based on filename and chunk count
    return `${fileName}_${totalChunks}_${crypto.randomUUID()}`;
  }

  async cleanup(fileId?: string): Promise<void> {
    try {
      if (fileId) {
        // Clean up specific file
        const upload = this.activeUploads.get(fileId);
        if (upload) {
          await Deno.remove(upload.tempDir, { recursive: true });
          this.activeUploads.delete(fileId);
        }
      } else {
        // Clean up all temporary files
        await Deno.remove(this.tempDir, { recursive: true });
        this.activeUploads.clear();
      }
    } catch {
      // Ignore errors if directory doesn't exist
    }
  }
}

export const chunkedUploadManager = new ChunkedUploadManager(); 