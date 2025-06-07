// Routes for file uploads

import { Router } from "../deps.ts";
import { handleFileUpload } from "../controllers/uploadController.ts";
import { handlePreUpload, handlePreUploadCleanup } from "../controllers/preUploadController.ts";

// Create a router
const router = new Router();

// Route for pre-upload preparation
router.post("/api/pre-upload", async (ctx) => {
  try {
    await handlePreUpload(ctx);
  } catch (error) {
    console.error("Error handling pre-upload:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      error: "Failed to handle pre-upload",
      details: error instanceof Error ? error.message : String(error)
    };
  }
});

// Route for pre-upload cleanup
router.delete("/api/pre-upload/cleanup/:fileId?", async (ctx) => {
  try {
    await handlePreUploadCleanup(ctx);
  } catch (error) {
    console.error("Error handling pre-upload cleanup:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      error: "Failed to handle pre-upload cleanup",
      details: error instanceof Error ? error.message : String(error)
    };
  }
});

// Route for file uploads
router.post("/api/upload", async (ctx) => {
  try {
    // Handle the upload using the upload controller
    await handleFileUpload(ctx);
  } catch (error) {
    console.error("Error handling file upload:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      error: "Failed to handle file upload",
      details: error instanceof Error ? error.message : String(error)
    };
  }
});

// Export the router
export { router as uploadRouter };
export const uploadRoutesAllowedMethods = router.allowedMethods(); 