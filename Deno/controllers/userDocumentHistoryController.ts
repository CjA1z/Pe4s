import { UserDocumentHistoryModel } from "../models/userDocumentHistoryModel.ts";
import { verifySessionToken } from "../utils/sessionUtils.ts";

/**
 * Record a document view action
 * @param request The HTTP request object
 * @returns Response object with success/error status
 */
export async function recordDocumentView(request: Request): Promise<Response> {
  try {
    // Get authorization token
    const authHeader = request.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    
    if (!token) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }), 
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
    
    // Verify the token and get user info
    const sessionData = await verifySessionToken(token);
    if (!sessionData) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }), 
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
    
    // Get document ID from request body
    const requestData = await request.json();
    const documentId = requestData.documentId;
    
    if (!documentId) {
      return new Response(
        JSON.stringify({ error: "Document ID is required" }), 
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    
    // Record the document view
    const success = await UserDocumentHistoryModel.recordAction(
      sessionData.id,
      parseInt(documentId),
      "VIEW"
    );
    
    if (!success) {
      return new Response(
        JSON.stringify({ error: "Failed to record document view" }), 
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
    
    return new Response(
      JSON.stringify({ success: true }), 
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error recording document view:", error);
    
    return new Response(
      JSON.stringify({ 
        error: "Failed to record document view",
        details: error instanceof Error ? error.message : String(error)
      }), 
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

/**
 * Record a document download action
 * @param request The HTTP request object
 * @returns Response object with success/error status
 */
export async function recordDocumentDownload(request: Request): Promise<Response> {
  try {
    // Get authorization token
    const authHeader = request.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    
    if (!token) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }), 
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
    
    // Verify the token and get user info
    const sessionData = await verifySessionToken(token);
    if (!sessionData) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }), 
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
    
    // Get document ID from request body
    const requestData = await request.json();
    const documentId = requestData.documentId;
    
    if (!documentId) {
      return new Response(
        JSON.stringify({ error: "Document ID is required" }), 
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    
    // Record the document download
    const success = await UserDocumentHistoryModel.recordAction(
      sessionData.id,
      parseInt(documentId),
      "DOWNLOAD"
    );
    
    if (!success) {
      return new Response(
        JSON.stringify({ error: "Failed to record document download" }), 
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
    
    return new Response(
      JSON.stringify({ success: true }), 
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error recording document download:", error);
    
    return new Response(
      JSON.stringify({ 
        error: "Failed to record document download",
        details: error instanceof Error ? error.message : String(error)
      }), 
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

/**
 * Get user document history with filters
 * @param request The HTTP request object
 * @returns Response object with history entries
 */
export async function getUserHistory(request: Request): Promise<Response> {
  try {
    // Get authorization token
    const authHeader = request.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    
    if (!token) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }), 
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
    
    // Verify the token and get user info
    const sessionData = await verifySessionToken(token);
    if (!sessionData) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }), 
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
    
    // Extract query parameters for filtering
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");
    const offset = (page - 1) * limit;
    
    // Build filters object
    const filters = {
      category: url.searchParams.get("category") || "all",
      keyword: url.searchParams.get("keyword") || "all",
      startDate: url.searchParams.get("startDate") || "",
      endDate: url.searchParams.get("endDate") || "",
      searchTerm: url.searchParams.get("search") || "",
      sortBy: url.searchParams.get("sortBy") || "date-saved-desc",
      limit,
      offset
    };
    
    // Get history entries with pagination
    const result = await UserDocumentHistoryModel.getUserHistory(sessionData.id, filters);
    
    // Get available categories and keywords for filters
    const categories = await UserDocumentHistoryModel.getHistoryCategories(sessionData.id);
    const keywords = await UserDocumentHistoryModel.getHistoryKeywords(sessionData.id);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        items: result.items,
        totalCount: result.totalCount,
        currentPage: page,
        totalPages: Math.ceil(result.totalCount / limit),
        filters: {
          availableCategories: categories,
          availableKeywords: keywords
        }
      }), 
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error retrieving user document history:", error);
    
    return new Response(
      JSON.stringify({ 
        error: "Failed to retrieve user document history",
        details: error instanceof Error ? error.message : String(error)
      }), 
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
} 