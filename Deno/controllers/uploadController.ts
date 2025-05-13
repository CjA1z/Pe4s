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
    
    // For replacements, use the directory from the original path
    if (isReplacement && originalPath) {
      const lastSlashIndex = originalPath.lastIndexOf('/');
      if (lastSlashIndex !== -1) {
        storagePath = originalPath.substring(0, lastSlashIndex);
        console.log("[UPLOAD_DEBUG] Using storage path from original:", storagePath);
      }
    }
    
    // Default to hello directory if no path specified
    if (!storagePath) {
      storagePath = "storage/hello";
    }
    
    // Normalize storage path
    storagePath = storagePath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    
    // Get the workspace root directory (parent of Deno directory)
    const workspaceRoot = Deno.cwd().replace(/[\\/]Deno$/, '');
    
    // Make sure the storage path is for the workspace level, not inside the Deno directory
    if (storagePath.includes("Deno/storage")) {
      storagePath = storagePath.replace("Deno/storage", "storage");
      console.log("[UPLOAD_DEBUG] Fixed storage path to be at workspace level:", storagePath);
    }
    
    console.log("[UPLOAD_DEBUG] Final storage path:", storagePath);
    console.log("[UPLOAD_DEBUG] Workspace root:", workspaceRoot);
    
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