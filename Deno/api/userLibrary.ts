import { 
  addToLibrary, 
  checkLibraryStatus, 
  getUserLibrary, 
  removeFromLibrary 
} from "../controllers/userLibraryController.ts";
import { DocumentModel } from "../models/documentModel.ts";
import { UserLibraryModel } from "../models/userLibraryModel.ts";
import { verifySessionToken } from "../utils/sessionUtils.ts";

/**
 * Handle library requests based on method
 * @param req The HTTP request
 * @returns HTTP response
 */
export async function handleLibraryRequest(req: Request): Promise<Response> {
  const method = req.method;
  
  // Handle different HTTP methods
  switch (method) {
    case "POST":
      return await addToLibrary(req);
    case "GET":
      // Check if this is for checking if a document is in the library
      const url = new URL(req.url);
      if (url.pathname.endsWith("/check")) {
        return await checkLibraryStatus(req);
      } else if (url.pathname.endsWith("/documents")) {
        return await getSavedDocuments(req);
      } else {
        return await getUserLibrary(req);
      }
    case "DELETE":
      return await removeFromLibrary(req);
    default:
      return new Response(
        JSON.stringify({ error: `Method ${method} not allowed` }), 
        { status: 405, headers: { "Content-Type": "application/json" } }
      );
  }
}

/**
 * Get detailed document information for all saved documents in user's library
 * @param req The HTTP request
 * @returns Response with detailed document information
 */
export async function getSavedDocuments(req: Request): Promise<Response> {
  try {
    // Verify user authentication
    const authHeader = req.headers.get("Authorization") || "";
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
    
    // Get basic saved documents from the library
    const savedDocs = await UserLibraryModel.getUserLibrary(userId);
    
    // Fetch complete document information for each saved document
    const enhancedDocuments = await Promise.all(
      savedDocs.map(async (savedDoc: any) => {
        try {
          // Document details are now already included from the joined query
          return {
            ...savedDoc,
            // Format date for easier frontend display
            saved_at_formatted: new Date(savedDoc.saved_at).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })
          };
        } catch (error) {
          console.error(`Error enhancing document ${savedDoc.doc_id}:`, error);
          // Return basic information if we can't fetch full details
          return savedDoc;
        }
      })
    );
    
    // Get library count
    const count = await UserLibraryModel.getLibraryCount(userId);
    
    // Update the session data with the library count
    try {
      // Update the user info in session storage with library count
      const userInfoKey = `user:${userId}`;
      const userInfoStr = await sessionStorage.getItem(userInfoKey);
      
      if (userInfoStr) {
        const userInfo = JSON.parse(userInfoStr);
        userInfo.libraryCount = count;
        await sessionStorage.setItem(userInfoKey, JSON.stringify(userInfo));
      }
    } catch (sessionError) {
      console.warn("Error updating user session with library count:", sessionError);
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        documents: enhancedDocuments,
        count
      }), 
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error fetching saved documents:", error);
    
    return new Response(
      JSON.stringify({ 
        error: "Failed to fetch saved documents",
        details: error instanceof Error ? error.message : String(error)
      }), 
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
} 