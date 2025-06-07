import { Router } from "../deps.ts";
import { chunkedUploadManager } from "../services/chunkedUploadService.ts";

const router = new Router();

router.post("/api/upload", async (ctx) => {
  try {
    const body = await ctx.request.body({ type: "form-data" });
    const formData = await body.value.read();
    
    const file = formData.files?.[0];
    if (!file || !file.filename) {
      ctx.response.status = 400;
      ctx.response.body = { error: "No file provided" };
      return;
    }

    // Get chunk information from form data
    const chunkIndex = parseInt(formData.fields?.chunkIndex || "0");
    const totalChunks = parseInt(formData.fields?.totalChunks || "1");
    const fileName = formData.fields?.fileName || file.name;
    const documentType = formData.fields?.document_type || "HELLO";

    // Validate chunk information
    if (isNaN(chunkIndex) || isNaN(totalChunks) || chunkIndex < 0 || totalChunks < 1) {
      ctx.response.status = 400;
      ctx.response.body = { 
        error: "Invalid chunk information",
        details: {
          chunkIndex,
          totalChunks,
          fileName,
          documentType
        }
      };
      return;
    }

    // Validate document type
    const validDocumentTypes = ["THESIS", "DISSERTATION", "CONFLUENCE", "SYNERGY", "HELLO"];
    const normalizedType = documentType.toUpperCase();
    if (!validDocumentTypes.includes(normalizedType)) {
      ctx.response.status = 400;
      ctx.response.body = { error: `Invalid document type. Must be one of: ${validDocumentTypes.join(", ")}` };
      return;
    }

    // Determine the correct storage path based on document type
    const storagePath = `storage/${normalizedType.toLowerCase()}`;

    // Read the file content
    let fileContent: Uint8Array;
    try {
      fileContent = await Deno.readFile(file.filename);
    } catch (error) {
      console.error("Error reading uploaded chunk:", error);
      ctx.response.status = 500;
      ctx.response.body = { error: "Failed to read uploaded chunk" };
      return;
    }

    // Handle the chunk
    try {
      const result = await chunkedUploadManager.handleChunk(fileContent, {
        chunkIndex,
        totalChunks,
        fileName,
        document_type: normalizedType
      });

      ctx.response.status = 200;
      ctx.response.body = {
        message: "File uploaded successfully",
        filePath: result.filePath,
        originalName: result.fileName,
        size: result.size,
        metadata: null,
        fileType: "other",
        isReplacement: false,
        status: "success",
        timestamp: new Date().toISOString(),
        details: {
          fullPath: result.filePath,
          storagePath: storagePath,
          originalFileName: file.filename,
          documentType: normalizedType
        }
      };
    } catch (error) {
      console.error("Error handling chunk:", error);
      ctx.response.status = 500;
      ctx.response.body = { 
        error: "Failed to process chunk",
        details: error instanceof Error ? error.message : "Unknown error"
      };
    }
  } catch (error: unknown) {
    console.error("Upload error:", error);
    ctx.response.status = 500;
    ctx.response.body = { 
      error: error instanceof Error ? error.message : "An unknown error occurred",
      details: error instanceof Error ? error.stack : undefined
    };
  }
});

router.post("/api/upload/cleanup", async (ctx) => {
    try {
        const body = await ctx.request.body({ type: "json" }).value;
        const fileId = body.fileId;

        if (!fileId) {
            ctx.response.status = 400;
            ctx.response.body = { error: "No fileId provided" };
            return;
        }

        await chunkedUploadManager.cleanup(fileId);
        
        ctx.response.status = 200;
        ctx.response.body = { message: "Cleanup successful" };
    } catch (error) {
        console.error("Cleanup error:", error);
        ctx.response.status = 500;
        ctx.response.body = { 
            error: "Cleanup failed",
            details: error instanceof Error ? error.message : "Unknown error"
        };
    }
});

export default router; 