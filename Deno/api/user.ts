import { handleGetUserProfile } from "../controllers/userController.ts";

/**
 * Handle get user profile request
 * This endpoint will be used by the navbar to get user information
 */
export async function handleUserProfile(req: Request): Promise<Response> {
  if (req.method === "GET") {
    // Pass the request to the controller function
    return await handleGetUserProfile(req);
  }
  
  return new Response("Method Not Allowed", { 
    status: 405,
    headers: { "Content-Type": "application/json" }
  });
}

/**
 * This handler is specifically for the /api/user/profile endpoint
 * used by the navbar to get user information
 */
export async function handleGetUserProfileForNavbar(req: Request): Promise<Response> {
  try {
    // Add support for CORS if needed
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization"
        }
      });
    }
    
    if (req.method !== "GET") {
      return new Response(JSON.stringify({ error: "Method Not Allowed" }), { 
        status: 405,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
    
    // For development convenience, always return mock data if no userId provided
    const url = new URL(req.url);
    if (!url.searchParams.has("userId")) {
      url.searchParams.set("mock", "true");
      const modifiedRequest = new Request(url.toString(), req);
      return await handleGetUserProfile(modifiedRequest);
    }
    
    // Otherwise, delegate to the main handler
    return await handleGetUserProfile(req);
  } catch (error) {
    console.error("Error in handleGetUserProfileForNavbar:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error processing request" 
    }), {
      status: 500,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}
