// Upload controller for handling file uploads

import { join } from "../deps.ts";
import { Context } from "../deps.ts";
import { saveFile, FileWithContent } from "../services/uploadService.ts";
import { extractPdfMetadata } from "../services/pdfService.ts";
import { PreUploadManager } from "../services/preUploadService.ts";

interface FormDataFile {
  name?: string;
  filename?: string;
  content?: Uint8Array;
  contentType?: string;
  size: number;
}

interface FormDataFields {
  [key: string]: string | FormDataFile;
}

interface FormDataResult {
  files?: FormDataFile[];
  fields: FormDataFields;
}

// Get the singleton instance of PreUploadManager
const preUploadManager = PreUploadManager.getInstance();

/**
 * Handle file upload request
 * @param ctx The Oak context
 * @returns HTTP response 
 */
export async function handleFileUpload(ctx: Context): Promise<void> {
  try {
    console.log("[UPLOAD_DEBUG] Starting upload request processing");
    
    // Check if content type is multipart/form-data
    const contentType = ctx.request.headers.get("content-type");
    if (!contentType || !contentType.includes("multipart/form-data")) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Content-Type must be multipart/form-data" };
      return;
    }
    
    // Get form data
    const form = await ctx.request.body({ type: "form-data" }).value;
    const data = await form.read({ 
      maxSize: 550_000_000 // 550MB total form limit
    });
    
    // Check if this is a pre-uploaded file
    const preparedFileId = data.fields.preparedFileId;
    let file: FileWithContent;

    if (preparedFileId) {
      // Get the prepared file
      const preparedFile = preUploadManager.getPreparedFile(preparedFileId);
      if (!preparedFile) {
        ctx.response.status = 400;
        ctx.response.body = { error: "Prepared file not found. Please try uploading again." };
        return;
      }

      // Instead of reading the file again, just pass the temp path and move flag
      const tempPath = `temp/pre-upload/${preparedFileId}`;
      file = {
        name: preparedFile.fileName,
        type: preparedFile.fileType,
        path: tempPath,
        size: preparedFile.fileSize,
        shouldMove: true // Flag to indicate we should move instead of copy
      };
    } else {
      // Get file from form data as usual
      const formFile = data.files?.[0] as FormDataFile | undefined;
      if (!formFile) {
        ctx.response.status = 400;
        ctx.response.body = { error: "No file provided in the request" };
        return;
      }

      // Convert FormDataFile to FileWithContent
      file = {
        name: formFile.filename || formFile.name || "unnamed_file",
        type: formFile.contentType || "application/octet-stream",
        content: formFile.content,
        size: formFile.size,
        shouldMove: false
      };
    }
    
    // Get document type and category from form data
    const documentType = data.fields.document_type?.toString().toUpperCase() || "HELLO";
    const category = data.fields.category?.toString() || "";
    
    // Determine storage path based on document type
    const storagePath = `storage/${documentType.toLowerCase()}`;
    
    // Get title from form data
    const title = data.fields.title?.toString() || "";
    
    // Validate document type only for document uploads
    const validDocumentTypes = ["THESIS", "DISSERTATION", "CONFLUENCE", "SYNERGY", "HELLO"];
    if (!validDocumentTypes.includes(documentType)) {
      ctx.response.status = 400;
      ctx.response.body = { error: `Invalid document type. Must be one of: ${validDocumentTypes.join(", ")}` };
      return;
    }
    
    console.log("[UPLOAD_DEBUG] Request details:");
    console.log("- File name:", file.name || file.filename);
    console.log("- File size:", file.size, "bytes");
    console.log("- Document type:", documentType);
    console.log("- Category:", category);
    console.log("- Title:", title);
    
    // Clean up the path for safety
    let cleanedStoragePath = storagePath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    
    // Get the workspace root directory (parent of Deno directory)
    const workspaceRoot = Deno.cwd().replace(/[\\/]Deno$/, '');
    console.log("[UPLOAD_DEBUG] Workspace root:", workspaceRoot);
    
    // Special handling for foreword files
    const isFileNameForeword = file && 
                              typeof file === 'object' && 
                              (file as any).filename && 
                              ((file as any).filename.toLowerCase().includes('foreword'));
    const isForewordUpload = isFileNameForeword || 
                            (data.fields.document_type && data.fields.document_type.toString().toLowerCase().includes('foreword')) || 
                            data.fields.is_foreword === 'true';
    
    console.log(`[UPLOAD_DEBUG] File appears to be foreword? ${isForewordUpload ? 'YES' : 'NO'}`);
    
    // Default storage path if one is not provided
    if (!cleanedStoragePath) {
        cleanedStoragePath = "storage/hello";
        console.log("[UPLOAD_DEBUG] Using default storage path:", cleanedStoragePath);
    }
    
    // Add forewords subdirectory for foreword files
    if (isForewordUpload) {
        cleanedStoragePath = `${cleanedStoragePath}/forewords`;
        console.log("[UPLOAD_DEBUG] Using foreword storage path:", cleanedStoragePath);
    }
    
    // Clean up the path for safety
    cleanedStoragePath = cleanedStoragePath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    
    // Ensure storage path is at workspace level
    if (cleanedStoragePath.includes("Deno/storage")) {
        cleanedStoragePath = cleanedStoragePath.replace("Deno/storage", "storage");
        console.log("[UPLOAD_DEBUG] Fixed storage path to be at workspace level:", cleanedStoragePath);
    }
    
    console.log("[UPLOAD_DEBUG] Final storage path:", cleanedStoragePath);
    
    // Save file with replacement options if needed
    const saveOptions = {
      documentType,
      category,
      title
    };
    
    console.log("[UPLOAD_DEBUG] Saving file with options:", saveOptions);
    
    // Save file
    const fileResult = await saveFile(file, cleanedStoragePath, saveOptions);
    console.log("[UPLOAD_DEBUG] File saved successfully:", fileResult);
    
    // Verify file was saved
    const fullFilePath = join(workspaceRoot, fileResult.path).replace(/\\/g, '/');
    try {
      const stat = await Deno.stat(fullFilePath);
      console.log("[UPLOAD_DEBUG] File verified at", fullFilePath, "size:", stat.size, "bytes");
    } catch (statError: unknown) {
      const errorMessage = statError instanceof Error ? statError.message : String(statError);
      console.error("[UPLOAD_DEBUG] Could not verify saved file:", errorMessage);
    }
    
    // Extract metadata if it's a PDF file
    let metadata = null;
    const isPdf = (file.name || file.filename || "").toLowerCase().endsWith('.pdf');
    
    if (isPdf) {
      console.log("[UPLOAD_DEBUG] Extracting PDF metadata");
      try {
        metadata = await extractPdfMetadata(fullFilePath);
        console.log("[UPLOAD_DEBUG] PDF metadata extracted:", metadata);
      } catch (metadataError: unknown) {
        const errorMessage = metadataError instanceof Error ? metadataError.message : String(metadataError);
        console.error("[UPLOAD_DEBUG] Error extracting PDF metadata:", errorMessage);
      }
    }
    
    // Clean up prepared file if it exists
    if (preparedFileId) {
      await preUploadManager.cleanup(preparedFileId);
    }
    
    // Return response with file path and metadata
    const response = {
      message: "File uploaded successfully",
      filePath: "/" + fileResult.path.replace(/\\/g, "/"),
      originalName: fileResult.name,
      size: fileResult.size,
      type: isPdf ? "pdf" : "other",
      metadata: metadata || null,
      status: "success",
      timestamp: new Date().toISOString(),
      details: {
        fullPath: fileResult.path,
        storagePath: cleanedStoragePath,
        documentType: documentType
      }
    };
    
    // Ensure the file path starts with /storage/ and does not contain absolute paths
    if (response.filePath.match(/^\/[A-Za-z]:\//)) {
      // Extract just the storage path part
      const parts = response.filePath.split('/');
      const storageIndex = parts.findIndex(part => part === 'storage');
      
      if (storageIndex !== -1) {
        // Reconstruct the path starting from 'storage'
        response.filePath = '/' + parts.slice(storageIndex).join('/');
      }
    }
    
    console.log("[UPLOAD_DEBUG] - Sending response:", response);
    
    ctx.response.status = 200;
    ctx.response.body = response;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[UPLOAD_DEBUG] Upload error:", errorMessage);
    
    ctx.response.status = 500;
    ctx.response.body = {
      error: "Failed to upload file",
      status: "error",
      details: errorMessage,
      timestamp: new Date().toISOString(),
      debug: {
        errorType: error instanceof Error ? error.name : typeof error,
        requestInfo: {
          method: ctx.request.method,
          url: ctx.request.url.pathname,
          contentType: ctx.request.headers.get("content-type") || "unknown"
        }
      }
    };
  }
}

/**
 * Handle profile picture upload
 * @param file The profile picture file
 * @param ctx The Oak context
 */
export async function handleProfilePictureUpload(
  file: any, 
  ctx: Context
): Promise<void> {
  try {
    // Handle profile picture upload
    const storagePath = "storage/authors/profile-pictures";
    const saveOptions = {
      documentType: "PROFILE_PICTURE",
      category: "PROFILE"
    };
    
    // Save profile picture
    const fileResult = await saveFile(file, storagePath, saveOptions);
    
    // Extract just the filename from the path
    const matches = fileResult.path.match(/([^/\\]+)$/);
    const filename = matches ? matches[1] : fileResult.name;
    
    // Create a consistent relative path
    const relativePath = `storage/authors/profile-pictures/${filename}`;
    
    console.log(`Profile picture uploaded: ${filename}, stored at: ${relativePath}`);
    
    ctx.response.status = 200;
    ctx.response.body = {
      message: "Profile picture uploaded successfully",
      filePath: `/${relativePath}`,
      originalName: fileResult.name,
      size: fileResult.size,
      status: "success",
      timestamp: new Date().toISOString()
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[UPLOAD_DEBUG] Profile picture upload error:", errorMessage);
    
    ctx.response.status = 500;
    ctx.response.body = {
      error: "Failed to upload profile picture",
      status: "error",
      details: errorMessage,
      timestamp: new Date().toISOString()
    };
  }
} 