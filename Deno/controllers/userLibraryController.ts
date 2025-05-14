import { UserLibraryModel } from "../models/userLibraryModel.ts";
import { verifySessionToken } from "../utils/sessionUtils.ts";

/**
 * Add a document to user's library
 * @param request The HTTP request object
 * @returns Response object with result
 */
export async function addToLibrary(request: Request): Promise<Response> {
  try {
    // Verify user authentication
    const authHeader = request.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    
    if (!token) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }), 
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
    
    const sessionData = await verifySessionToken(token);
    if (!sessionData) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }), 
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
    
    // Get request body
    const body = await request.json();
    
    // Validate required parameters
    if (!body.documentId) {
      return new Response(
        JSON.stringify({ error: "Document ID is required" }), 
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    
    // Use the user ID from the token for security
    const userId = sessionData.id;
    const documentId = parseInt(body.documentId, 10);
    
    if (isNaN(documentId)) {
      return new Response(
        JSON.stringify({ error: "Invalid document ID" }), 
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    
    // Check if document is already in library
    const isInLibrary = await UserLibraryModel.isInLibrary(userId, documentId);
    
    if (isInLibrary) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Document is already in your library",
          inLibrary: true,
          count: await UserLibraryModel.getLibraryCount(userId)
        }), 
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }
    
    // Add document to library
    await UserLibraryModel.addToLibrary(userId, documentId);
    
    // Get updated library count
    const libraryCount = await UserLibraryModel.getLibraryCount(userId);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Document added to library successfully",
        count: libraryCount
      }), 
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error adding document to library:", error);
    
    return new Response(
      JSON.stringify({ 
        error: "Failed to add document to library",
        details: error instanceof Error ? error.message : String(error)
      }), 
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

/**
 * Check if a document is in user's library
 * @param request The HTTP request object
 * @returns Response object with result
 */
export async function checkLibraryStatus(request: Request): Promise<Response> {
  try {
    // Verify user authentication
    const authHeader = request.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    
    if (!token) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }), 
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
    
    const sessionData = await verifySessionToken(token);
    if (!sessionData) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }), 
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
    
    // Get URL parameters
    const url = new URL(request.url);
    const documentId = parseInt(url.searchParams.get("documentId") || "", 10);
    
    if (isNaN(documentId)) {
      return new Response(
        JSON.stringify({ error: "Invalid or missing document ID" }), 
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    
    // Use the user ID from the token for security
    const userId = sessionData.id;
    
    // Check if document is in library
    const inLibrary = await UserLibraryModel.isInLibrary(userId, documentId);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        inLibrary,
        count: await UserLibraryModel.getLibraryCount(userId)
      }), 
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error checking library status:", error);
    
    return new Response(
      JSON.stringify({ 
        error: "Failed to check library status",
        details: error instanceof Error ? error.message : String(error)
      }), 
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

/**
 * Get all documents in user's library
 * @param request The HTTP request object
 * @returns Response object with library documents
 */
export async function getUserLibrary(request: Request): Promise<Response> {
  try {
    // Verify user authentication
    const authHeader = request.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    
    if (!token) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }), 
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
    
    const sessionData = await verifySessionToken(token);
    if (!sessionData) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }), 
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
    
    // Use the user ID from the token for security
    const userId = sessionData.id;
    
    // Get library documents
    const library = await UserLibraryModel.getUserLibrary(userId);
    const count = await UserLibraryModel.getLibraryCount(userId);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        documents: library,
        count
      }), 
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error retrieving user library:", error);
    
    return new Response(
      JSON.stringify({ 
        error: "Failed to retrieve user library",
        details: error instanceof Error ? error.message : String(error)
      }), 
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

/**
 * Remove a document from user's library
 * @param request The HTTP request object
 * @returns Response object with result
 */
export async function removeFromLibrary(request: Request): Promise<Response> {
  try {
    // Verify user authentication
    const authHeader = request.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    
    if (!token) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }), 
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
    
    const sessionData = await verifySessionToken(token);
    if (!sessionData) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }), 
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
    
    // Get URL parameters or request body
    let documentId: number;
    
    if (request.method === "DELETE") {
      // For DELETE requests, get document ID from URL
      const url = new URL(request.url);
      documentId = parseInt(url.searchParams.get("documentId") || "", 10);
    } else {
      // For other methods (e.g., POST), get document ID from request body
      const body = await request.json();
      documentId = parseInt(body.documentId || "", 10);
    }
    
    if (isNaN(documentId)) {
      return new Response(
        JSON.stringify({ error: "Invalid or missing document ID" }), 
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    
    // Use the user ID from the token for security
    const userId = sessionData.id;
    
    // Remove document from library
    const removed = await UserLibraryModel.removeFromLibrary(userId, documentId);
    
    if (!removed) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Document was not in your library"
        }), 
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }
    
    // Get updated library count
    const libraryCount = await UserLibraryModel.getLibraryCount(userId);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Document removed from library successfully",
        count: libraryCount
      }), 
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error removing document from library:", error);
    
    return new Response(
      JSON.stringify({ 
        error: "Failed to remove document from library",
        details: error instanceof Error ? error.message : String(error)
      }), 
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
} 