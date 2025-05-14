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
    
    // Get days parameter, default to 30
    const days = parseInt(ctx.request.url.searchParams.get("days") || "30");
    
    // Get visit statistics from the counter table
    const visitStats = await AuthorVisitsModel.getAuthorVisitCounters(authorId, days);
    
    // For backward compatibility, also include total visits from legacy method
    const totalVisits = await AuthorVisitsModel.getTotalVisits(authorId);
    
    ctx.response.status = 200;
    ctx.response.body = { 
      authorId,
      ...visitStats,
      legacy_total: totalVisits
    };
  } catch (error) {
    console.error("Error in getAuthorVisitStats:", error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Internal server error" };
  }
}

/**
 * Get top authors by visit count
 * GET /api/author-visits/top-authors
 */
async function getTopAuthors(ctx: RouterContext<string>) {
  try {
    // Get limit parameter, default to 5
    const limit = parseInt(ctx.request.url.searchParams.get("limit") || "5");
    
    // Get days parameter, default to 30
    const days = parseInt(ctx.request.url.searchParams.get("days") || "30");
    
    // Get top authors
    const authors = await AuthorVisitsModel.getTopAuthors(limit, days);
    
    ctx.response.status = 200;
    ctx.response.body = { 
      authors,
      count: authors.length,
      timeframe: `${days} days`
    };
  } catch (error) {
    console.error("Error in getTopAuthors:", error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Internal server error" };
  }
}

/**
 * COMPATIBILITY: Get top authors for admin dashboard
 * GET /api/author-visits/stats
 */
async function compatGetTopAuthorsForDashboard(ctx: RouterContext<string>) {
  try {
    // Default limit for dashboard is 5
    const limit = 5;
    
    // Get days parameter, default to 30
    const days = 30;
    
    // Get top authors
    const authors = await AuthorVisitsModel.getTopAuthors(limit, days);
    
    // Format response for dashboard compatibility
    ctx.response.status = 200;
    ctx.response.body = { 
      success: true,
      topAuthors: authors.map(author => ({
        author_id: author.author_id,
        full_name: author.full_name,
        visit_count: author.visit_count,
        profile_picture: author.profile_picture || '/admin/Components/img/samp_pfp.jpg'
      }))
    };
  } catch (error) {
    console.error("Error in compatGetTopAuthorsForDashboard:", error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Internal server error" };
  }
}

/**
 * Purge old author visit data
 * DELETE /api/author-visits/purge
 * Query params: ?olderThan=365
 */
async function purgeOldVisitData(ctx: RouterContext<string>) {
  try {
    // Get olderThan parameter, default to 365 days
    const olderThan = parseInt(ctx.request.url.searchParams.get("olderThan") || "365");
    
    // Purge old visit data
    const deletedCount = await AuthorVisitsModel.purgeOldVisitData(olderThan);
    
    ctx.response.status = 200;
    ctx.response.body = { 
      success: true,
      message: `Purged ${deletedCount} author visit records older than ${olderThan} days`
    };
  } catch (error) {
    console.error("Error in purgeOldVisitData:", error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Internal server error" };
  }
}

// Record a visit to an author profile
router.post("/api/author-visits", recordAuthorVisit);

// Get visit statistics for a specific author
router.get("/api/author-visits/:authorId", getAuthorVisitStats);

// Get top authors by visit count
router.get("/api/author-visits/top-authors", getTopAuthors);

// COMPATIBILITY: Get top authors for admin dashboard
router.get("/api/author-visits/stats", compatGetTopAuthorsForDashboard);

// Purge old visit data
router.delete("/api/author-visits/purge", purgeOldVisitData);

// Export the router
export const authorVisitsRoutes = router.routes();
export const authorVisitsAllowedMethods = router.allowedMethods(); 