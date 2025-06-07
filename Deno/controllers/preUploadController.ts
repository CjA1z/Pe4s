import { RouterContext } from "../deps.ts";
import { PreUploadManager } from "../services/preUploadService.ts";

// Get the singleton instance of PreUploadManager
const preUploadManager = PreUploadManager.getInstance();

export async function handlePreUpload(ctx: RouterContext<"/api/pre-upload">): Promise<void> {
  try {
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
      maxSize: 100_000_000, // 100MB total form limit
      maxFileSize: 50_000_000 // 50MB per file limit
    });

    // Get file from form data
    const file = data.files?.[0];
    if (!file) {
      ctx.response.status = 400;
      ctx.response.body = { error: "No file provided in the request" };
      return;
    }

    // Get options from form data
    const options = {
      generatePreview: data.fields.generatePreview === "true",
      extractMetadata: data.fields.extractMetadata === "true",
      storagePath: data.fields.storagePath,
      is_foreword: data.fields.is_foreword === "true"
    };

    // If this is a foreword file, ensure the path includes the forewords subdirectory
    if (options.is_foreword && options.storagePath) {
      options.storagePath = options.storagePath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
      if (!options.storagePath.endsWith('/forewords')) {
        options.storagePath = `${options.storagePath}/forewords`;
      }
    }

    // Prepare the file
    const result = await preUploadManager.prepareFile(file, options);

    // Check for validation errors
    if (result.validationErrors && result.validationErrors.length > 0) {
      ctx.response.status = 400;
      ctx.response.body = {
        error: "File validation failed",
        validationErrors: result.validationErrors
      };
      return;
    }

    // Return success response
    ctx.response.status = 200;
    ctx.response.body = {
      message: "File prepared successfully",
      fileId: result.id,
      fileName: result.fileName,
      fileSize: result.fileSize,
      fileType: result.fileType,
      preview: result.preview,
      metadata: result.metadata
    };
  } catch (error: unknown) {
    console.error("Pre-upload error:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      error: "Failed to prepare file",
      details: error instanceof Error ? error.message : String(error)
    };
  }
}

export async function handlePreUploadCleanup(ctx: RouterContext<"/api/pre-upload/cleanup/:fileId?">): Promise<void> {
  try {
    const fileId = ctx.params.fileId;
    await preUploadManager.cleanup(fileId);
    
    ctx.response.status = 200;
    ctx.response.body = {
      message: fileId ? `Cleaned up file ${fileId}` : "Cleaned up all files"
    };
  } catch (error: unknown) {
    console.error("Pre-upload cleanup error:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      error: "Failed to clean up",
      details: error instanceof Error ? error.message : String(error)
    };
  }
} 