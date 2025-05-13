import { Router, RouterContext } from "../deps.ts";
import { PageVisitsModel } from "../models/pageVisitsModel.ts";

// Create a router for page visit routes
const router = new Router();

/**
 * Record a visit to a page
 * POST /api/page-visits
 * Body: { pageUrl: string, visitorType: "guest" | "user", userId?: string, metadata?: object }
 */
async function recordPageVisit(ctx: RouterContext<string>) {
  try {
    // Get request body
    const body = await ctx.request.body({ type: "json" }).value;
    
    // Validate required fields
    if (!body.pageUrl) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Page URL is required" };
      return;
    }
    
    // Default to guest if visitorType is not provided
    const visitorType = body.visitorType === 'user' ? 'user' : 'guest';
    
    // Get client IP address
    const ipAddress = ctx.request.ip;
    
    // Record the visit
    const visit = await PageVisitsModel.recordVisit(
      body.pageUrl,
      visitorType,
      body.userId,
      ipAddress,
      body.metadata
    );
    
    if (visit) {
      ctx.response.status = 201;
      ctx.response.body = { 
        success: true, 
        message: "Visit recorded successfully",
        data: visit
      };
    } else {
      ctx.response.status = 500;
      ctx.response.body = { error: "Failed to record visit." };
    }
  } catch (error) {
    console.error("Error in recordPageVisit:", error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Internal server error" };
  }
}

/**
 * Get total page visit statistics
 * GET /api/page-visits/stats
 */
async function getVisitStats(ctx: RouterContext<string>) {
  try {
    // Get total visit stats
    const stats = await PageVisitsModel.getTotalVisitStats();
    
    ctx.response.status = 200;
    ctx.response.body = { stats };
  } catch (error) {
    console.error("Error in getVisitStats:", error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Internal server error" };
  }
}

/**
 * Get home page visit statistics
 * GET /api/page-visits/home-stats
 */
async function getHomePageVisitStats(ctx: RouterContext<string>) {
  try {
    // Get homepage visit stats
    const stats = await PageVisitsModel.getHomePageVisitStats();
    
    ctx.response.status = 200;
    ctx.response.body = { stats };
  } catch (error) {
    console.error("Error in getHomePageVisitStats:", error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Internal server error" };
  }
}

/**
 * Get most visited documents
 * GET /api/page-visits/most-visited-documents
 * Query params: limit (default 10), days (optional)
 */
async function getMostVisitedDocuments(ctx: RouterContext<string>) {
  try {
    // Parse query parameters
    const url = new URL(ctx.request.url);
    const limitParam = url.searchParams.get('limit');
    const daysParam = url.searchParams.get('days');
    
    // Parse limit (default to 10)
    const limit = limitParam ? parseInt(limitParam) : 10;
    
    // Parse days (optional)
    const days = daysParam ? parseInt(daysParam) : undefined;
    
    // Get document information if available
    let documentInfo: Record<string, any> = {};
    try {
      // Try to get document details from database
      const detailsQuery = `
        SELECT id, title, document_type, publication_date, start_year, end_year, keywords 
        FROM documents 
        WHERE id = ANY($1)
      `;
      
      // First get the most visited documents
      const mostVisited = await PageVisitsModel.getMostVisitedDocuments(limit, days);
      
      // Extract document IDs
      const documentIds = mostVisited.map(doc => doc.document_id);
      
      // If we have document IDs, fetch their details
      if (documentIds.length > 0) {
        const detailsResult = await ctx.state.client?.queryObject(
          detailsQuery,
          [documentIds]
        );
        
        if (detailsResult?.rows) {
          detailsResult.rows.forEach((row: any) => {
            // Parse keywords properly from the database
            let parsedKeywords = [];
            if (row.keywords) {
              try {
                // Keywords might be stored in different formats
                if (Array.isArray(row.keywords)) {
                  parsedKeywords = row.keywords;
                } else if (typeof row.keywords === 'string') {
                  // Try to parse as JSON first, fall back to comma-separated if that fails
                  try {
                    parsedKeywords = JSON.parse(row.keywords);
                  } catch (e) {
                    // If not valid JSON, treat as comma-separated
                    parsedKeywords = row.keywords.split(',').map((k: string) => k.trim()).filter((k: string) => k);
                  }
                } else if (typeof row.keywords === 'object') {
                  // If it's already an object but not an array, get its values
                  parsedKeywords = Object.values(row.keywords);
                }
              } catch (e) {
                console.error(`Error parsing keywords for document ${row.id}:`, e);
                parsedKeywords = [];
              }
            }
            
            documentInfo[row.id] = {
              title: row.title,
              document_type: row.document_type,
              keywords: parsedKeywords
            };
          });
        }
      }
    } catch (error) {
      console.error("Error fetching document details:", error);
      // Continue without details - non-critical error
    }
    
    // Get most visited documents
    const documents = await PageVisitsModel.getMostVisitedDocuments(limit, days);
    
    // Add details if available
    const documentsWithDetails = documents.map(doc => {
      const details = documentInfo[doc.document_id] || {};
      return {
        ...doc,
        title: details.title,
        document_type: details.document_type,
        keywords: details.keywords
      };
    });
    
    ctx.response.status = 200;
    ctx.response.body = { 
      documents: documentsWithDetails,
      count: documentsWithDetails.length,
      timeframe: days ? `${days} days` : 'all time'
    };
  } catch (error) {
    console.error("Error in getMostVisitedDocuments:", error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Internal server error" };
  }
}

/**
 * Get visit statistics for a specific document
 * GET /api/page-visits/document/:id
 */
async function getDocumentVisitStats(ctx: RouterContext<string>) {
  try {
    const documentId = ctx.params.id;
    
    if (!documentId) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Document ID is required" };
      return;
    }
    
    // Get document visit stats
    const stats = await PageVisitsModel.getDocumentVisitStats(documentId);
    
    ctx.response.status = 200;
    ctx.response.body = { 
      document_id: documentId,
      stats 
    };
  } catch (error) {
    console.error(`Error in getDocumentVisitStats for document ${ctx.params.id}:`, error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Internal server error" };
  }
}

// Define routes
router.post("/api/page-visits", recordPageVisit);
router.get("/api/page-visits/stats", getVisitStats);
router.get("/api/page-visits/home-stats", getHomePageVisitStats);
router.get("/api/page-visits/most-visited-documents", getMostVisitedDocuments);
router.get("/api/page-visits/document/:id", getDocumentVisitStats);

// Export the routes
export const pageVisitsRoutes = router.routes();
export const pageVisitsAllowedMethods = router.allowedMethods(); 