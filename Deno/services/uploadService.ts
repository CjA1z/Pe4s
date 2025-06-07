// Simple file upload service

import { ensureDir, extname, join } from "../deps.ts";
import { createFile } from "../controllers/fileController.ts";

interface FileUploadOptions {
  keepOriginalName?: boolean;
  originalName?: string;
  originalPath?: string;
  documentType?: string;
  category?: string;
  title?: string;
}

interface FileResponse {
  path: string;
  name: string;
  size: number;
  type: string;
}

interface FileWithContent {
  name?: string;
  content?: Uint8Array;
  bytes?: Uint8Array;
  path?: string;
  arrayBuffer?: () => Promise<ArrayBuffer>;
  type?: string;
}

/**
 * Creates the directory structure for a given document type and category
 * @param documentType The type of document (THESIS, DISSERTATION, etc.)
 * @param category Optional category within the document type
 * @returns The created directory path
 */
async function createDocumentTypeDirectory(documentType: string, category?: string): Promise<string> {
  // Get the workspace root directory (parent of Deno directory)
  const workspaceRoot = Deno.cwd().replace(/[\\/]Deno$/, '');
  
  // Simplified structure: storage/[documentType]
  // Convert document type to lowercase for directory naming
  const directoryName = documentType.toLowerCase();
  const baseDir = join(workspaceRoot, 'storage', directoryName).replace(/\\/g, '/');
  
  try {
    // Create base directory if it doesn't exist
    try {
      await Deno.mkdir(baseDir, { recursive: true });
    } catch (error) {
      if (!(error instanceof Deno.errors.AlreadyExists)) {
        throw error;
      }
    }
    
    // We no longer create category subdirectories for a flatter structure
    return baseDir;
  } catch (error) {
    console.error(`[UPLOAD_DEBUG] Error creating directory structure: ${error}`);
    throw error;
  }
}

/**
 * Save a file to the specified path
 * @param file The file to save
 * @param storagePath The path to save the file to (relative to the project root)
 * @param options Additional options for the save operation
 * @returns The path to the saved file (relative to the project root)
 */
export async function saveFile(
  file: FileWithContent | Uint8Array | ArrayBuffer | string,
  storagePath = "storage/hello",
  options: FileUploadOptions = {}
): Promise<FileResponse> {
  console.log("[UPLOAD_DEBUG] Starting file save process");
  
  // Get the workspace root directory (parent of Deno directory)
  const workspaceRoot = Deno.cwd().replace(/[\\/]Deno$/, '');
  
  // Get document type and category from options
  const documentType = options.documentType?.toUpperCase() || "GENERAL";
  const category = options.category;
  
  try {
    // Normalize storage path to use forward slashes and no trailing slashes
    storagePath = storagePath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    
    // Create the target directory path - ensure we don't duplicate the workspace root
    const targetDir = storagePath.startsWith(workspaceRoot) 
      ? storagePath 
      : join(workspaceRoot, storagePath).replace(/\\/g, '/');
    
    // Ensure the directory exists
    try {
      await ensureDir(targetDir);
      console.log("[UPLOAD_DEBUG] - Directory ensured:", targetDir);
      
      // Verify directory was created
      const dirInfo = await Deno.stat(targetDir);
      if (!dirInfo.isDirectory) {
        throw new Error("Failed to create directory - path exists but is not a directory");
      }
    } catch (dirError) {
      const errorMessage = dirError instanceof Error ? dirError.message : String(dirError);
      console.error("[UPLOAD_DEBUG] Failed to create directory:", errorMessage);
      throw new Error(`Failed to create directory: ${errorMessage}`);
    }

    // Get original filename or generate one
    let originalName = "";
    if (typeof file === "object" && "name" in file) {
      originalName = file.name || "";
    } else if (options.originalName) {
      originalName = options.originalName;
    }
    
    // Determine file extension
    let fileExtension = "pdf"; // Default to PDF
    if (originalName && originalName.includes('.')) {
      const ext = originalName.split('.').pop()?.toLowerCase() || "pdf";
      // Only allow specific file extensions
      if (['pdf', 'doc', 'docx', 'rtf'].includes(ext)) {
        fileExtension = ext;
      }
    } else if (typeof file === "object" && "type" in file) {
      const mimeType = (file as FileWithContent).type;
      if (mimeType) {
        if (mimeType.includes('pdf')) {
          fileExtension = 'pdf';
        } else if (mimeType.includes('msword')) {
          fileExtension = 'doc';
        } else if (mimeType.includes('wordprocessingml')) {
          fileExtension = 'docx';
        }
      }
    }
    
    // Create filename based on title if available
    let finalFilename: string;
    if (options.title) {
      // Convert title to a URL-friendly format
      const safeTitle = options.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric chars with hyphens
        .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
      
      finalFilename = `${safeTitle}.${fileExtension}`;
      
      // If a file with this name already exists, add a number suffix
      let counter = 1;
      let testPath = join(targetDir, finalFilename).replace(/\\/g, '/');
      while (await Deno.stat(testPath).catch(() => false)) {
        finalFilename = `${safeTitle}-${counter}.${fileExtension}`;
        testPath = join(targetDir, finalFilename).replace(/\\/g, '/');
        counter++;
      }
    } else {
      // Use timestamp if no title is provided
      const timestamp = Date.now();
      finalFilename = `${timestamp}.${fileExtension}`;
    }
    
    console.log("[UPLOAD_DEBUG] - Original filename:", originalName);
    console.log("[UPLOAD_DEBUG] - Final filename:", finalFilename);
    console.log("[UPLOAD_DEBUG] - Storage path:", storagePath);
    console.log("[UPLOAD_DEBUG] - Target directory:", targetDir);
    
    // Construct full file path
    const filePath = join(targetDir, finalFilename).replace(/\\/g, '/');
    console.log("[UPLOAD_DEBUG] - File path:", filePath);
    
    // Get the file content
    let fileContent: Uint8Array;
    const fileObj = file as FileWithContent;
    
    if (fileObj.content) {
      fileContent = fileObj.content;
    } else if (fileObj.bytes) {
      fileContent = fileObj.bytes;
    } else if (fileObj.path) {
      fileContent = await Deno.readFile(fileObj.path);
    } else if (fileObj.arrayBuffer) {
      const buffer = await fileObj.arrayBuffer();
      fileContent = new Uint8Array(buffer);
    } else if (file instanceof Uint8Array || file instanceof ArrayBuffer) {
      fileContent = file instanceof ArrayBuffer ? new Uint8Array(file) : file;
    } else {
      throw new Error("Unsupported file format");
    }
    
    // Write the file
    await Deno.writeFile(filePath, fileContent);
    console.log("[UPLOAD_DEBUG] - File successfully written to disk");
    
    // Get file size
    const fileInfo = await Deno.stat(filePath);
    const fileSize = fileInfo.size;
    
    // Return file information
    return {
      path: storagePath + '/' + finalFilename,
      name: finalFilename,
      size: fileSize,
      type: (file as FileWithContent).type || getMimeTypeFromExtension(extname(finalFilename))
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[UPLOAD_DEBUG] - Error in saveFile:", message);
    throw new Error(`Failed to save file: ${message}`);
  }
}

/**
 * Delete a file
 * @param filePath The path to the file to delete
 */
export async function deleteFile(filePath: string): Promise<void> {
  try {
    console.log("Deleting file:", filePath);
    await Deno.remove(filePath);
    console.log(`File ${filePath} successfully deleted`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error deleting file ${filePath}:`, error);
    throw new Error(`Failed to delete file: ${message}`);
  }
}

/**
 * Get MIME type from file extension
 * @param extension File extension with dot (e.g., ".pdf")
 * @returns MIME type string or application/octet-stream if unknown
 */
function getMimeTypeFromExtension(extension: string): string {
  const mimeTypes: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.doc': 'application/msword',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls': 'application/vnd.ms-excel',
    '.txt': 'text/plain',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.zip': 'application/zip',
    '.rar': 'application/x-rar-compressed',
    '.mp4': 'video/mp4',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav'
  };
  
  return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
} 