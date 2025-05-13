// Routes for file uploads

import { Router } from "../deps.ts";
import { handleFileUpload } from "../controllers/uploadController.ts";

// Create a router
const router = new Router();

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
export const uploadRoutes = router;
export const uploadRoutesAllowedMethods = router.allowedMethods(); 