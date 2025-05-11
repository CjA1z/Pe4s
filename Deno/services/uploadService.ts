// Simple file upload service

import { ensureDir, extname, join } from "../deps.ts";
import { createFile } from "../controllers/fileController.ts";

interface FileUploadOptions {
  keepOriginalName?: boolean;
  originalName?: string;
  originalPath?: string;
  documentType?: string;
  category?: string;
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
    // Create appropriate directory structure
    const targetDir = await createDocumentTypeDirectory(documentType, category);
    
    // Generate timestamp for unique filename
    const timestamp = Date.now();
    
    // Get original filename or generate one
    let originalName = "";
    if (typeof file === "object" && "name" in file) {
      originalName = file.name || "";
    } else if (options.originalName) {
      originalName = options.originalName;
    }
    
    // Generate unique filename
    let fileExtension = (originalName || "unknown.bin").split(".").pop() || "bin";
    
    // Detect file type and ensure proper extension for known types
    const fileType = (typeof file === "object" && "type" in file && file.type) ? file.type : "";
    if (fileType.includes("pdf") || originalName.toLowerCase().endsWith(".pdf")) {
      fileExtension = "pdf";
    } else if (fileType.includes("word") || originalName.toLowerCase().match(/\.(docx?|rtf)$/)) {
      fileExtension = originalName.toLowerCase().endsWith(".docx") ? "docx" : originalName.toLowerCase().endsWith(".doc") ? "doc" : "rtf";
    } else if (fileType.includes("image/") || originalName.toLowerCase().match(/\.(jpg|jpeg|png|gif|bmp|svg)$/i)) {
      fileExtension = originalName.toLowerCase().split('.').pop() || "jpg";
    }
    
    const uniqueFilename = `${timestamp}_${Math.floor(Math.random() * 10000)}.${fileExtension}`;
    
    // Construct full file path using path.join and normalize to forward slashes
    const filePath = join(targetDir, uniqueFilename).replace(/\\/g, '/');
    
    console.log("[UPLOAD_DEBUG] - Original filename:", originalName);
    console.log("[UPLOAD_DEBUG] - Storage path:", storagePath);
    console.log("[UPLOAD_DEBUG] - Target directory:", targetDir);
    console.log("[UPLOAD_DEBUG] - File path:", filePath);
    console.log("[UPLOAD_DEBUG] - Options:", JSON.stringify(options));
    
    // Normalize storage path to use forward slashes and no leading/trailing slashes
    storagePath = storagePath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    
    // Make sure the storage path is relative to the workspace root, not the Deno directory
    // If storagePath doesn't start with the workspace root, prepend it
    const fullStoragePath = storagePath.startsWith(workspaceRoot) 
      ? storagePath 
      : join(workspaceRoot, storagePath).replace(/\\/g, '/');
    
    // Ensure the directory exists
    await ensureDir(fullStoragePath);
    console.log("[UPLOAD_DEBUG] - Directory ensured:", fullStoragePath);
    
    let finalFilename: string;
    if (options.keepOriginalName && options.originalName) {
      // For replacements, use the original name
      finalFilename = options.originalName;
      console.log("[UPLOAD_DEBUG] - Using original filename for replacement:", finalFilename);
    } else {
      // Create a unique filename based on timestamp and original filename
      finalFilename = uniqueFilename;
      console.log("[UPLOAD_DEBUG] - Generated unique filename:", finalFilename);
    }
    
    // Create the full path using forward slashes
    const fullFilePath = join(fullStoragePath, finalFilename).replace(/\\/g, '/');
    console.log("[UPLOAD_DEBUG] - Full file path:", fullFilePath);
    
    // If this is a replacement, try to delete both the original path and the new path
    if (options.keepOriginalName && options.originalPath) {
      try {
        // Try to delete file at original path - make sure this is relative to workspace root
        let normalizedOriginalPath = options.originalPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');

        console.log("[UPLOAD_DEBUG] - Original path before normalization:", options.originalPath);
        console.log("[UPLOAD_DEBUG] - Normalized path:", normalizedOriginalPath);
        console.log("[UPLOAD_DEBUG] - Workspace root:", workspaceRoot);
        
        // Handle absolute paths that start with protocol or drive letter
        if (normalizedOriginalPath.startsWith('http:') || normalizedOriginalPath.startsWith('https:')) {
          // Extract just the path portion for URLs
          try {
            const url = new URL(normalizedOriginalPath);
            normalizedOriginalPath = url.pathname.replace(/^\/+/, '');
            console.log("[UPLOAD_DEBUG] - Extracted pathname from URL:", normalizedOriginalPath);
          } catch (urlError) {
            console.warn("[UPLOAD_DEBUG] - Failed to parse URL:", urlError);
          }
        } else if (normalizedOriginalPath.match(/^[A-Za-z]:\//)) {
          // For Windows paths, extract the path relative to storage directory
          const parts = normalizedOriginalPath.split('/');
          const storageIndex = parts.findIndex(part => part === 'storage');
          if (storageIndex !== -1) {
            normalizedOriginalPath = parts.slice(storageIndex).join('/');
            console.log("[UPLOAD_DEBUG] - Extracted storage path from absolute path:", normalizedOriginalPath);
          } else {
            console.warn("[UPLOAD_DEBUG] - Could not find 'storage' in path:", normalizedOriginalPath);
          }
        }
        
        // If the original path doesn't start with the workspace root, prepend it
        if (!normalizedOriginalPath.startsWith(workspaceRoot)) {
          normalizedOriginalPath = join(workspaceRoot, normalizedOriginalPath).replace(/\\/g, '/');
        }
        
        console.log("[UPLOAD_DEBUG] - Final path for original file removal:", normalizedOriginalPath);
        
        const originalExists = await Deno.stat(normalizedOriginalPath).catch((err) => {
          console.warn("[UPLOAD_DEBUG] - Could not stat original file:", err.message);
          return false;
        });
        
        if (originalExists) {
          await Deno.remove(normalizedOriginalPath);
          console.log("[UPLOAD_DEBUG] - Successfully removed original file");
        } else {
          console.log("[UPLOAD_DEBUG] - Original file not found at:", normalizedOriginalPath);
        }
        
        // Also try to delete at the new path if it's different
        if (normalizedOriginalPath !== fullFilePath) {
          console.log("[UPLOAD_DEBUG] - Checking new path:", fullFilePath);
          const newExists = await Deno.stat(fullFilePath).catch(() => false);
          if (newExists) {
            await Deno.remove(fullFilePath);
            console.log("[UPLOAD_DEBUG] - Successfully removed file at new path");
          }
        }
      } catch (error: unknown) {
        // Log error but continue with upload
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.warn("[UPLOAD_DEBUG] - Error during file cleanup:", errorMsg);
        console.warn("[UPLOAD_DEBUG] - Will continue with upload despite cleanup error");
      }
    }

    // Get the file content - enhanced to handle more formats
    let fileContent: Uint8Array;
    const fileObj = file as FileWithContent;
    console.log("[UPLOAD_DEBUG] - Processing file content. Available properties:", Object.keys(fileObj));

    if (fileObj.content) {
      console.log("[UPLOAD_DEBUG] - Using direct content");
      fileContent = fileObj.content;
    } else if (fileObj.bytes) {
      console.log("[UPLOAD_DEBUG] - Using bytes property");
      fileContent = fileObj.bytes;
    } else if (fileObj.path) {
      console.log("[UPLOAD_DEBUG] - Reading from temporary path:", fileObj.path);
      try {
        fileContent = await Deno.readFile(fileObj.path);
        console.log("[UPLOAD_DEBUG] - Successfully read file from temporary path");
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[UPLOAD_DEBUG] - Error reading from temporary path:", message);
        throw new Error(`Could not read temporary file: ${message}`);
      }
    } else if (fileObj.arrayBuffer) {
      console.log("[UPLOAD_DEBUG] - Using arrayBuffer method");
      try {
        const buffer = await fileObj.arrayBuffer();
        fileContent = new Uint8Array(buffer);
        console.log("[UPLOAD_DEBUG] - Successfully converted arrayBuffer to Uint8Array");
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[UPLOAD_DEBUG] - Error processing array buffer:", message);
        throw new Error(`Could not process file buffer: ${message}`);
      }
    } else if (file instanceof Uint8Array || file instanceof ArrayBuffer) {
      console.log("[UPLOAD_DEBUG] - Using direct binary data");
      fileContent = file instanceof ArrayBuffer ? new Uint8Array(file) : file;
    } else if (typeof file === 'string' && file.startsWith('data:')) {
      console.log("[UPLOAD_DEBUG] - Processing data URI");
      try {
        const base64String = file.split(',')[1];
        fileContent = Uint8Array.from(atob(base64String), c => c.charCodeAt(0));
        console.log("[UPLOAD_DEBUG] - Successfully processed data URI");
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[UPLOAD_DEBUG] - Error processing data URI:", message);
        throw new Error(`Invalid data URI format: ${message}`);
      }
    } else {
      console.error("[UPLOAD_DEBUG] - Unsupported file format. File object:", file);
      throw new Error("Unsupported file object format. File must contain a path, arrayBuffer method, content, or bytes property.");
    }
    
    if (!fileContent || fileContent.length === 0) {
      console.error("[UPLOAD_DEBUG] - File content is empty");
      throw new Error("File content is empty");
    }
    
    console.log("[UPLOAD_DEBUG] - Writing file to disk at:", fullFilePath);
    // Write the file to disk
    await Deno.writeFile(fullFilePath, fileContent);
    console.log("[UPLOAD_DEBUG] - File successfully written to disk");
    
    // Get file size
    let fileSize = 0;
    try {
      const fileInfo = await Deno.stat(fullFilePath);
      fileSize = fileInfo.size;
      console.log("[UPLOAD_DEBUG] - File size:", fileSize, "bytes");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn("[UPLOAD_DEBUG] - Warning: Could not get file size:", message);
    }
    
    // For the response, return the path relative to workspace root for API consistency
    // This ensures the file can be accessed via the correct URL
    const relativePath = fullFilePath.startsWith(workspaceRoot)
      ? fullFilePath.substring(workspaceRoot.length).replace(/^[\\/]+/, '')
      : fullFilePath;
    
    // Return file information without creating a database record
    const response = {
      path: relativePath,
      name: finalFilename,
      size: fileSize,
      type: (file as FileWithContent).type || getMimeTypeFromExtension(extname(finalFilename))
    };
    console.log("[UPLOAD_DEBUG] - Returning response:", response);
    return response;
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