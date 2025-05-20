import { client } from "../db/denopost_conn.ts";
import { join } from "https://deno.land/std@0.190.0/path/mod.ts";
import { ensureDir } from "https://deno.land/std@0.190.0/fs/ensure_dir.ts";
import { RouterContext } from "../deps.ts";

/**
 * Controller function to handle user profile picture uploads
 * 
 * @param ctx The Oak router context
 * @returns void - sets the response directly on the context
 */
export async function uploadUserProfilePicture(ctx: RouterContext<string>): Promise<void> {
  try {
    // Verify that the request is a POST
    if (ctx.request.method !== "POST") {
      ctx.response.status = 405;
      ctx.response.body = {
        error: "Method not allowed",
        message: "Only POST method is allowed for profile picture uploads"
      };
      return;
    }

    // Extract user ID from query parameters
    const userId = ctx.request.url.searchParams.get("userId");
    
    if (!userId) {
      ctx.response.status = 400;
      ctx.response.body = {
        error: "Missing user ID",
        message: "User ID is required to upload a profile picture"
      };
      return;
    }

    // Get the form data using Oak's built-in parser
    const body = ctx.request.body({ type: "form-data" });
    console.log("[PROFILE-PIC] Getting form data...");
    const formData = await body.value.read({ maxSize: 5 * 1024 * 1024 }); // 5MB max
    
    console.log(`[PROFILE-PIC] Form data received: files=${formData.files?.length || 0}, fields=${Object.keys(formData.fields || {}).length}`);
    
    // Check if there's a profile picture file
    if (!formData.files || formData.files.length === 0) {
      console.log("[PROFILE-PIC] No files found in form data");
      ctx.response.status = 400;
      ctx.response.body = {
        error: "Missing profile picture",
        message: "Profile picture file is required"
      };
      return;
    }
    
    // Get the file from the form data
    const profilePicture = formData.files[0];
    console.log(`[PROFILE-PIC] File details: name=${profilePicture.filename || "undefined"}, type=${profilePicture.contentType || "undefined"}, size=${profilePicture.content?.length || 0} bytes`);
    
    if (!profilePicture) {
      ctx.response.status = 400;
      ctx.response.body = {
        error: "Missing profile picture",
        message: "Profile picture file is required"
      };
      return;
    }

    // Validate the file type
    const acceptedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (profilePicture.contentType && !acceptedTypes.includes(profilePicture.contentType)) {
      ctx.response.status = 400;
      ctx.response.body = {
        error: "Invalid file type",
        message: "Profile picture must be JPEG, PNG, or WebP"
      };
      return;
    }

    // Generate a unique filename using user ID and timestamp
    // Handle case where filename might be undefined
    const originalFilename = profilePicture.filename || "profile.webp";
    const fileNameParts = originalFilename.split('.');
    const fileExtension = fileNameParts.length > 1 ? fileNameParts.pop() : "webp";
    const fileName = `${userId}_${Date.now()}.${fileExtension}`;
    
    // Set up the directory path for profile pictures
    // Get the workspace root directory (parent of Deno directory)
    const workspaceRoot = Deno.cwd().replace(/[\\/]Deno$/, '');
    const profilePicDir = join(workspaceRoot, "storage", "users", "profile-picture");
    
    // Ensure the directory exists
    await ensureDir(profilePicDir);
    
    // Save the file using the content from the form data
    const filePath = join(profilePicDir, fileName);
    await Deno.writeFile(filePath, profilePicture.content || new Uint8Array());
    
    console.log(`Profile picture saved at: ${filePath}`);
    
    // Update the user's profile picture in the database
    const relativeFilePath = `storage/users/profile-picture/${fileName}`;
    await client.queryObject(
      `UPDATE users SET profile_picture = $1 WHERE id = $2`,
      [relativeFilePath, userId]
    );

    // Log the profile picture change event
    try {
      console.log(`Profile picture updated for user ${userId} at ${new Date().toISOString()}, file: ${fileName}`);
    } catch (logError) {
      console.error("Failed to log profile picture change:", logError);
    }

    // Return the picture URL to the client
    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      message: "Profile picture uploaded successfully",
      pictureUrl: `/${relativeFilePath}`
    };
    
  } catch (error) {
    console.error("Error uploading profile picture:", error);
    
    ctx.response.status = 500;
    ctx.response.body = {
      error: "Server error",
      message: error instanceof Error ? error.message : "An unknown error occurred"
    };
  }
} 