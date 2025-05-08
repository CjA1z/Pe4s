import { Context } from "../deps.ts";
import { client } from "../db/denopost_conn.ts";

interface User {
  id: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  email?: string;
  username?: string;
  role?: string;
  created_at?: Date;
  updated_at?: Date;
}

/**
 * Get current user profile
 * This function assumes some form of authentication middleware
 * that would set a user ID in the request context/state
 */
export const getCurrentUser = async (ctx: Context) => {
  try {
    // In a real implementation, get the user ID from session/token
    // For now, this is a placeholder implementation that gets user ID from the request
    const userId = ctx.state.userId || ctx.request.url.searchParams.get("userId");
    
    if (!userId) {
      ctx.response.status = 401; // Unauthorized
      ctx.response.type = "application/json";
      ctx.response.body = { error: "User not authenticated" };
      return;
    }
    
    const result = await client.queryObject(
      `SELECT id, first_name, middle_name, last_name, email, username, role, created_at, updated_at
       FROM users 
       WHERE id = $1 AND deleted_at IS NULL`,
      [userId]
    );
    
    if (result.rows.length === 0) {
      ctx.response.status = 404;
      ctx.response.type = "application/json";
      ctx.response.body = { error: "User not found" };
      return;
    }
    
    const user = result.rows[0] as User;
    
    ctx.response.status = 200;
    ctx.response.type = "application/json";
    ctx.response.body = user;
  } catch (error) {
    console.error("Error fetching user profile:", error);
    ctx.response.status = 500;
    ctx.response.type = "application/json";
    ctx.response.body = { 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
};

/**
 * Get user by ID (for admin purposes)
 */
export const getUserById = async (ctx: Context) => {
  try {
    // Extract ID from URL parameters
    const url = new URL(ctx.request.url);
    const pathParts = url.pathname.split('/');
    const id = pathParts[pathParts.length - 1];
    
    if (!id) {
      ctx.response.status = 400;
      ctx.response.type = "application/json";
      ctx.response.body = { error: "User ID is required" };
      return;
    }
    
    const result = await client.queryObject(
      `SELECT id, first_name, middle_name, last_name, email, username, role, created_at, updated_at
       FROM users 
       WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    
    if (result.rows.length === 0) {
      ctx.response.status = 404;
      ctx.response.type = "application/json";
      ctx.response.body = { error: "User not found" };
      return;
    }
    
    const user = result.rows[0] as User;
    
    ctx.response.status = 200;
    ctx.response.type = "application/json";
    ctx.response.body = user;
  } catch (error) {
    console.error("Error fetching user by ID:", error);
    ctx.response.status = 500;
    ctx.response.type = "application/json";
    ctx.response.body = { 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
};

/**
 * API handler function to get current user profile (Direct Request/Response)
 */
export const handleGetUserProfile = async (req: Request): Promise<Response> => {
  try {
    // In a production app, extract user ID from auth token or session
    // For testing purposes, we'll support a query parameter
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId");
    
    if (!userId) {
      // For testing/development, if no userId provided, return a mock user
      if (url.searchParams.get("mock") === "true") {
        return new Response(JSON.stringify({
          id: "mock-user-id",
          first_name: "Maria",
          middle_name: "Santos",
          last_name: "Garcia",
          email: "maria.garcia@example.com",
          username: "mgarcia",
          role: "user"
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      
      return new Response(JSON.stringify({ 
        error: "User not authenticated" 
      }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    const result = await client.queryObject(
      `SELECT id, first_name, middle_name, last_name, email, username, role, created_at, updated_at
       FROM users 
       WHERE id = $1 AND deleted_at IS NULL`,
      [userId]
    );
    
    if (result.rows.length === 0) {
      return new Response(JSON.stringify({ 
        error: "User not found" 
      }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    return new Response(JSON.stringify(result.rows[0]), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Error handling user profile request:", error);
    
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
