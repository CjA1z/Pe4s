import { Router, RouterContext } from "../deps.ts";
import { AuthorVisitsModel } from "../models/authorVisitsModel.ts";

// Create a router for author visit routes
const router = new Router();

/**
 * Record a visit to an author profile
 * POST /api/author-visits
 * Body: { authorId: string, visitorType: "guest" | "user", userId?: string }
 */
async function recordAuthorVisit(ctx: RouterContext<string>) {
  try {
    // Get request body
    const body = await ctx.request.body({ type: "json" }).value;
    
    // Validate required fields
    if (!body.authorId) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Author ID is required" };
      return;
    }
    
    // Default to guest if visitorType is not provided
    const visitorType = body.visitorType === 'user' ? 'user' : 'guest';
    
    // Get client IP address
    const ipAddress = ctx.request.ip;
    
    // Record the visit
    const visit = await AuthorVisitsModel.recordVisit(
      body.authorId,
      visitorType,
      body.userId,
      ipAddress
    );
    
    if (visit) {
      ctx.response.status = 201;
      ctx.response.body = { 
        success: true, 
        message: "Visit recorded successfully",
        data: visit
      };
    } else {
      ctx.response.status = 404;
      ctx.response.body = { error: "Failed to record visit. Author may not exist." };
    }
  } catch (error) {
    console.error("Error in recordAuthorVisit:", error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Internal server error" };
  }
}

/**
 * Get the top authors by visit count
 * GET /api/author-visits/top-authors?limit=5
 */
async function getTopAuthors(ctx: RouterContext<string>) {
  try {
    // Get limit from query parameter (default to 5)
    const limitParam = ctx.request.url.searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam) : 5;
    
    // Get top authors
    const topAuthors = await AuthorVisitsModel.getTopAuthors(limit);
    
    ctx.response.status = 200;
    ctx.response.body = { topAuthors };
  } catch (error) {
    console.error("Error in getTopAuthors:", error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Internal server error" };
  }
}

/**
 * Get total visit statistics
 * GET /api/author-visits/stats
 */
async function getVisitStats(ctx: RouterContext<string>) {
  try {
    // Get total visit stats
    const stats = await AuthorVisitsModel.getTotalVisitStats();
    
    ctx.response.status = 200;
    ctx.response.body = { stats };
  } catch (error) {
    console.error("Error in getVisitStats:", error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Internal server error" };
  }
}

/**
 * Get visit statistics for a specific author
 * GET /api/author-visits/:authorId
 */
async function getAuthorVisitStats(ctx: RouterContext<string>) {
  try {
    // Get author ID from URL parameter
    const authorId = ctx.params.authorId;
    
    if (!authorId) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Author ID is required" };
      return;
    }
    
    // Get total visits for the author
    const totalVisits = await AuthorVisitsModel.getTotalVisits(authorId);
    
    // Get breakdown by visitor type
    const visitsByType = await AuthorVisitsModel.getVisitsByType(authorId);
    
    ctx.response.status = 200;
    ctx.response.body = { 
      authorId,
      totalVisits,
      guestVisits: visitsByType.guest,
      userVisits: visitsByType.user
    };
  } catch (error) {
    console.error("Error in getAuthorVisitStats:", error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Internal server error" };
  }
}

// Define routes
router.post("/api/author-visits", recordAuthorVisit);
router.get("/api/author-visits/top-authors", getTopAuthors);
router.get("/api/author-visits/stats", getVisitStats);
router.get("/api/author-visits/:authorId", getAuthorVisitStats);

// Export the routes
export const authorVisitsRoutes = router.routes();
export const authorVisitsAllowedMethods = router.allowedMethods(); 