// Upload controller for handling file uploads

import { join } from "../deps.ts";
import { Context } from "../deps.ts";
import { saveFile } from "../services/uploadService.ts";
import { extractPdfMetadata } from "../services/pdfService.ts";

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
      maxFileSize: 500_000_000, // 500MB limit
      maxSize: 550_000_000 // 550MB total form limit
    });
    
    // Get file from form data
    let file = data.files?.[0];
    
    if (!file) {
      // Look for the file in a field named "file" if no files array is found
      for (const [key, value] of Object.entries(data.fields)) {
        if (key === "file" && value) {
          // If the value is a file-like object
          if (typeof value === "object" && (value.name || value.filename)) {
            file = value;
            break;
          }
        }
      }
      
      if (!file) {
        ctx.response.status = 400;
        ctx.response.body = { error: "No file provided in the request" };
        return;
      }
    }
    
    // Check if file has required properties
    if (!file.name && !file.filename) {
      file.name = "unnamed_file";
    }

    // Check if this is a profile picture upload
    const isProfilePicture = data.fields.is_profile_picture === "true";
    
    if (isProfilePicture) {
      // Handle profile picture upload
      return await handleProfilePictureUpload(file, ctx);
    }
    
    // Get storage path from form data or original path for replacements
    let storagePath = data.fields.storagePath;
    const isReplacement = data.fields.is_replacement === "true";
    const originalName = data.fields.original_name;
    let originalPath = data.fields.original_path;
    
    // Get document type and category information
    const documentType = data.fields.document_type || "GENERAL";
    const category = data.fields.category;
    
    // Validate document type only for document uploads
    const validDocumentTypes = ["THESIS", "DISSERTATION", "CONFLUENCE", "SYNERGY", "HELLO"];
    if (!validDocumentTypes.includes(documentType.toUpperCase())) {
      ctx.response.status = 400;
      ctx.response.body = { error: `Invalid document type. Must be one of: ${validDocumentTypes.join(", ")}` };
      return;
    }
    
    console.log("[UPLOAD_DEBUG] Request details:");
    console.log("- File name:", file.name || file.filename);
    console.log("- File size:", file.size, "bytes");
    console.log("- Is replacement:", isReplacement);
    console.log("- Original name:", originalName);
    console.log("- Original path:", originalPath);
    
    // Normalize path separators to forward slashes and remove leading/trailing slashes
    if (originalPath) {
      originalPath = originalPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    }
    
    // Special handling for foreword files
    const isFileNameForeword = file && 
                              typeof file === 'object' && 
                              (file as any).filename && 
                              ((file as any).filename.toLowerCase().includes('foreword'));
    const isForewordUpload = isFileNameForeword || 
                            (data.fields.document_type && data.fields.document_type.toString().toLowerCase().includes('foreword')) || 
                            data.fields.is_foreword === 'true';
    
    console.log(`[UPLOAD_DEBUG] File appears to be foreword? ${isForewordUpload ? 'YES' : 'NO'}`);
    
    // Extract storage path from original path if available
    if (originalPath && originalPath.includes('/')) {
      const lastSlashIndex = originalPath.lastIndexOf('/');
        storagePath = originalPath.substring(0, lastSlashIndex);
        console.log("[UPLOAD_DEBUG] Using storage path from original:", storagePath);
    }
    
    // Default storage path if one is not provided
    if (!storagePath) {
      storagePath = "storage/hello";
       console.log("[UPLOAD_DEBUG] Using default storage path:", storagePath);
    }
    
    // Clean up the path for safety
    storagePath = storagePath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    
    // Handle foreword files specially - ensure they go to a forewords subfolder
    if (isForewordUpload) {
       console.log("[UPLOAD_DEBUG] Detected foreword file upload");
       
       // Extract document type from path or from form data
       const pathParts = storagePath.split('/');
       let docType = 'hello'; // Default
       
       // Try to get document type from path
       if (pathParts.length > 1) {
           docType = pathParts[1].toLowerCase();
       }
       
       // Override with document_type from form data if available
       if (data.fields.document_type) {
           docType = data.fields.document_type.toString().toLowerCase();
       }
       
       // Handle various document types - ensure they're valid
       const validDocTypes = ['thesis', 'dissertation', 'confluence', 'synergy', 'hello'];
       if (!validDocTypes.includes(docType)) {
           docType = 'hello';
       }
       
       // Ensure the path correctly includes the document type and forewords subfolder
       if (storagePath.includes('forewords')) {
           // Path already includes forewords subfolder, verify its structure
           const forewordDirIndex = storagePath.indexOf('forewords');
           const beforeForewordDir = storagePath.substring(0, forewordDirIndex);
           
           if (!beforeForewordDir.includes(docType)) {
               // Needs correcting - rebuild the path
               storagePath = `storage/${docType}/forewords`;
           }
       } else {
           // Build the proper foreword path
           storagePath = `storage/${docType}/forewords`;
       }
       
       console.log("[UPLOAD_DEBUG] Final foreword directory path:", storagePath);
    }
    
    // Ensure storage path is at workspace level
    if (storagePath.includes("Deno/storage")) {
      storagePath = storagePath.replace("Deno/storage", "storage");
      console.log("[UPLOAD_DEBUG] Fixed storage path to be at workspace level:", storagePath);
    }
    
    console.log("[UPLOAD_DEBUG] Final storage path:", storagePath);
    
    // Get the workspace root directory (parent of Deno directory)
    const workspaceRoot = Deno.cwd().replace(/[\\/]Deno$/, '');
    
    console.log("[UPLOAD_DEBUG] Workspace root:", workspaceRoot);
    
    // Ensure foreword directories exist if this is a foreword upload
    if (isForewordUpload) {
        // Ensure the directory exists
        try {
            const fullPath = join(workspaceRoot, storagePath);
            await Deno.mkdir(fullPath, { recursive: true });
            console.log("[UPLOAD_DEBUG] Created or verified foreword directory:", fullPath);
        } catch (dirError) {
            console.warn("[UPLOAD_DEBUG] Directory creation warning:", dirError instanceof Error ? dirError.message : String(dirError));
            // Continue with upload attempt
        }
    }
    
    // Save file with replacement options if needed
    const saveOptions = isReplacement && originalName ? {
      keepOriginalName: true,
      originalName: originalName,
      originalPath: originalPath, // Pass the full original path to the upload service
      documentType,
      category
    } : {
      documentType,
      category
    };
    
    console.log("[UPLOAD_DEBUG] Saving file with options:", saveOptions);
    
    // Save file
    const fileResult = await saveFile(file, storagePath, saveOptions);
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
    
    // Return response with file path and metadata
    const response = {
      message: isReplacement ? "File replaced successfully" : "File uploaded successfully",
      filePath: "/" + fileResult.path.replace(/\\/g, "/"),
      originalName: fileResult.name,
      size: fileResult.size,
      metadata: metadata || null,
      fileType: isPdf ? "pdf" : "other",
      isReplacement: isReplacement,
      status: "success",
      timestamp: new Date().toISOString(),
      details: {
        fullPath: fileResult.path,
        storagePath: storagePath,
        originalFileName: file.name || file.filename,
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