/**
 * Session Service
 * Handles token generation and validation for user authentication.
 */

import { client } from "../db/denopost_conn.ts";

/**
 * Creates a session token for the user
 * @param userID - The user's ID
 * @param userRole - The user's role (admin, staff, student, etc.)
 * @returns A unique session token
 */
export async function createSessionToken(userID: string, userRole: string): Promise<string> {
  console.log(`Creating token for user ${userID} with role ${userRole}`);
  
  try {
    // Generate a UUID for the token
    const token = crypto.randomUUID();
    
    // Set expiration time (24 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Save the token to the database
    try {
      await client.queryObject(
        `INSERT INTO sessions (user_id, token, expires_at) 
         VALUES ($1, $2, $3)`,
        [userID, token, expiresAt]
    );
      console.log(`Token saved to database: ${token.substring(0, 8)}...`);
    } catch (dbError) {
      console.error("Database error when saving token:", dbError);
      console.log("Continuing without saving token to database");
    }
    
    return token;
  } catch (error) {
    console.error("Error creating session token:", error);
    throw error;
  }
}

/**
 * Validates a session token
 * @param token - The token to validate
 * @returns The user ID if valid, null otherwise
 */
export async function validateSessionToken(token: string | null): Promise<string | null> {
  if (!token) return null;
  
  try {
    const result = await client.queryObject(
      `SELECT user_id FROM sessions WHERE token = $1 AND expires_at > NOW()`,
      [token]
    );
    
    if (!result.rows || result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0].user_id;
  } catch (error) {
    console.error("Database error when validating token:", error);
    return null;
  }
}

/**
 * Deletes a session token
 * @param token - The token to delete
 * @returns True if successful, false otherwise
 */
export async function deleteSessionToken(token: unknown): Promise<boolean> {
  if (token === null || token === undefined) {
    console.log("No token provided for deletion");
    return false;
  }
  
  let tokenString: string;
  
  // Handle different token types, including objects
  if (typeof token === 'object') {
    try {
      console.log("Token is an object, attempting to stringify for deletion");
      tokenString = JSON.stringify(token);
    } catch (jsonError) {
      console.error("Failed to stringify token object:", jsonError);
      tokenString = String(token);
    }
  } else {
    tokenString = String(token);
  }
  
  // Log token type and part of the value for debugging
  try {
    const tokenStart = tokenString.substring(0, 8);
    const tokenEnd = tokenString.length > 16 ? tokenString.substring(tokenString.length - 8) : '';
    console.log(`Attempting to delete token (type: ${typeof token}): ${tokenStart}...${tokenEnd}`);
  } catch (logError) {
    console.error("Error logging token:", logError);
  }
  
  // Try deleting from multiple tables to ensure all session data is removed
  let deletedFromAnyTable = false;
  
  try {
    // Try to delete from sessions table
    try {
      const result = await client.queryObject(
        `DELETE FROM sessions WHERE token = $1 RETURNING token`,
        [tokenString]
      );
      
      if (result.rows && result.rows.length > 0) {
        console.log(`Deleted token from sessions table: ${tokenString.substring(0, 8)}...`);
        deletedFromAnyTable = true;
      } else {
        console.log(`No matching token found in sessions table: ${tokenString.substring(0, 8)}...`);
      }
    } catch (sessionsError) {
      console.error("Error deleting from sessions table:", sessionsError);
    }
    
    // Also try to delete from tokens table if it exists
    try {
      const tokensResult = await client.queryObject(
        `DELETE FROM tokens WHERE token = $1 RETURNING token`,
        [tokenString]
      );
      
      if (tokensResult.rows && tokensResult.rows.length > 0) {
        console.log(`Deleted token from tokens table: ${tokenString.substring(0, 8)}...`);
        deletedFromAnyTable = true;
      } else {
        console.log(`No matching token found in tokens table: ${tokenString.substring(0, 8)}...`);
      }
    } catch (tokensError) {
      console.log("Note: Could not delete from tokens table (might not exist)");
    }
    
    return deletedFromAnyTable;
  } catch (error) {
    console.error("Database error when deleting token:", error);
    return false;
  }
}
