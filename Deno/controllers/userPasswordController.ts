import { client } from "../db/denopost_conn.ts";

/**
 * Controller function to update a user's password
 * 
 * @param request The HTTP request
 * @returns HTTP response
 */
export async function updateUserPassword(request: Request): Promise<Response> {
  try {
    // Verify that the request is a PUT
    if (request.method !== "PUT") {
      return new Response(
        JSON.stringify({ 
          error: "Method not allowed",
          message: "Only PUT method is allowed for password updates"
        }),
        { status: 405, headers: { "Content-Type": "application/json" } }
      );
    }

    // Extract user ID from query parameters
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId");
    
    if (!userId) {
      return new Response(
        JSON.stringify({ 
          error: "Missing user ID",
          message: "User ID is required to update password"
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Extract password data from request body
    let requestBody;
    try {
      requestBody = await request.json();
    } catch (error) {
      return new Response(
        JSON.stringify({ 
          error: "Invalid JSON",
          message: "Request body must be valid JSON"
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { currentPassword, newPassword } = requestBody;

    // Validate input
    if (!currentPassword || !newPassword) {
      return new Response(
        JSON.stringify({ 
          error: "Missing required fields",
          message: "Current password and new password are required"
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (newPassword.length < 8) {
      return new Response(
        JSON.stringify({ 
          error: "Password too short",
          message: "New password must be at least 8 characters"
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Verify the current password
    const credResult = await client.queryObject(
      `SELECT user_id FROM credentials WHERE user_id = $1 AND password = $2`,
      [userId, currentPassword]
    );

    if (!credResult.rows || credResult.rows.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: "Authentication failed",
          message: "Current password is incorrect"
        }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Update the password
    await client.queryObject(
      `UPDATE credentials SET password = $1, updated_at = NOW() WHERE user_id = $2`,
      [newPassword, userId]
    );

    // Log the password change event (optional but recommended for security)
    try {
      // Just log to console for now, could be expanded to use a proper logging system
      console.log(`Password updated for user ${userId} at ${new Date().toISOString()}`);
    } catch (logError) {
      console.error("Failed to log password change:", logError);
      // Continue with the password change even if logging fails
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Password updated successfully"
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error("Error updating password:", error);
    
    return new Response(
      JSON.stringify({ 
        error: "Server error",
        message: error instanceof Error ? error.message : "An unknown error occurred"
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
} 