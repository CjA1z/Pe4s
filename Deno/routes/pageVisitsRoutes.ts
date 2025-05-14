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
    
    // Record the visit in both counter and legacy tables
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
 * Get visit stats for documents
 * GET /api/page-visits/documents/:documentId
 */
async function getDocumentVisitStats(ctx: RouterContext<string>) {
  try {
    const documentId = ctx.params.documentId;
    
    if (!documentId) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Document ID is required" };
      return;
    }
    
    // Get days parameter, default to 30
    const days = parseInt(ctx.request.url.searchParams.get("days") || "30");
    
    // Get the visit stats from counter table
    const visitStats = await PageVisitsModel.getDocumentVisitCounters(documentId, days);
    
    ctx.response.status = 200;
    ctx.response.body = visitStats;
  } catch (error) {
    console.error(`Error getting document visit stats:`, error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Internal server error" };
  }
}

/**
 * Get most visited documents
 * GET /api/page-visits/most-visited-documents
 */
async function getMostVisitedDocuments(ctx: RouterContext<string>) {
  try {
    // Get limit parameter, default to 10
    const limit = parseInt(ctx.request.url.searchParams.get("limit") || "10");
    
    // Get days parameter, default to 30
    const days = parseInt(ctx.request.url.searchParams.get("days") || "30");
    
    // Get the most visited documents
    const documents = await PageVisitsModel.getMostVisitedDocuments(limit, days);
    
    ctx.response.status = 200;
    ctx.response.body = { documents };
  } catch (error) {
    console.error(`Error getting most visited documents:`, error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Internal server error" };
  }
}

/**
 * Get most visited pages
 * GET /api/page-visits/most-visited-pages
 */
async function getMostVisitedPages(ctx: RouterContext<string>) {
  try {
    // Get limit parameter, default to 10
    const limit = parseInt(ctx.request.url.searchParams.get("limit") || "10");
    
    // Get days parameter, default to 30
    const days = parseInt(ctx.request.url.searchParams.get("days") || "30");
    
    // Get the most visited pages
    const pages = await PageVisitsModel.getMostVisitedPages(limit, days);
    
    ctx.response.status = 200;
    ctx.response.body = { pages };
  } catch (error) {
    console.error(`Error getting most visited pages:`, error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Internal server error" };
  }
}

/**
 * Purge old visit data
 * DELETE /api/page-visits/purge
 * Query params: ?olderThan=365
 */
async function purgeOldVisitData(ctx: RouterContext<string>) {
  try {
    // Get olderThan parameter, default to 365 days
    const olderThan = parseInt(ctx.request.url.searchParams.get("olderThan") || "365");
    
    // Purge old visit data
    const result = await PageVisitsModel.purgeOldVisitData(olderThan);
    
    ctx.response.status = 200;
    ctx.response.body = { 
      success: true,
      message: `Purged visit data older than ${olderThan} days`,
      result
    };
  } catch (error) {
    console.error(`Error purging old visit data:`, error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Internal server error" };
  }
}

/**
 * COMPATIBILITY: Get most visited documents for the dashboard
 * GET /api/most-visited-documents
 */
async function compatGetMostVisitedDocuments(ctx: RouterContext<string>) {
  try {
    // Extract query parameters
    const period = parseInt(ctx.request.url.searchParams.get("period") || "30");
    const limit = parseInt(ctx.request.url.searchParams.get("limit") || "10");
    
    // Get the most visited documents using our counter system
    const documents = await PageVisitsModel.getMostVisitedDocuments(limit, period);
    
    // Format the response for dashboard compatibility
    ctx.response.status = 200;
    ctx.response.body = { 
      success: true,
      documents: documents.map(doc => ({
        id: doc.doc_id,
        visits: doc.total_visits
      })),
      period: period
    };
  } catch (error) {
    console.error(`Error in compatibility getMostVisitedDocuments:`, error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Internal server error" };
  }
}

/**
 * COMPATIBILITY: Get visit statistics by timeframe for dashboard charts
 * GET /api/page-visits/stats/:timeframe
 */
async function compatGetVisitStatsByTimeframe(ctx: RouterContext<string>) {
  try {
    const timeframe = ctx.params.timeframe || "daily";
    
    // Default days based on timeframe
    let days = 30;
    if (timeframe === "weekly") days = 90;
    if (timeframe === "monthly") days = 365;
    
    // Get visit stats for home pages as a representative sample
    const homePaths = ['/', '/index.html', '/index'];
    let totalVisits = 0;
    let guestVisits = 0;
    let userVisits = 0;
    let dailyData: {date: string, count: number, guest: number, user: number}[] = [];
    
    for (const path of homePaths) {
      const stats = await PageVisitsModel.getPageVisitCounters(path, days);
      totalVisits += stats.total;
      guestVisits += stats.guest;
      userVisits += stats.user;
      
      // Combine daily data
      stats.daily.forEach(dayStats => {
        const existingDay = dailyData.find(d => d.date === dayStats.date);
        if (existingDay) {
          existingDay.count += dayStats.count;
          existingDay.guest += dayStats.guest;
          existingDay.user += dayStats.user;
        } else {
          dailyData.push({...dayStats});
        }
      });
    }
    
    // Sort by date
    dailyData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Format for chart
    const chartData = dailyData.map(day => ({
      date: day.date,
      guest_visits: day.guest,
      user_visits: day.user
    }));
    
    ctx.response.status = 200;
    ctx.response.body = { 
      success: true,
      stats: {
        total: totalVisits,
        guest: guestVisits,
        user: userVisits,
        chart_data: chartData,
        timeframe: timeframe
      }
    };
  } catch (error) {
    console.error(`Error in compatibility getVisitStatsByTimeframe:`, error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Internal server error" };
  }
}

/**
 * COMPATIBILITY: Get general visit statistics for dashboard
 * GET /api/page-visits/stats
 */
async function compatGetGeneralVisitStats(ctx: RouterContext<string>) {
  try {
    // Default to 30 days
    const days = 30;
    
    // Get top pages to get an overall picture
    const topPages = await PageVisitsModel.getMostVisitedPages(100, days);
    
    // Calculate total visits and get breakdown
    let totalVisits = 0;
    let guestVisits = 0;
    let userVisits = 0;
    
    // Get visit stats for home pages to get an overall site view
    const homePaths = ['/', '/index.html', '/index'];
    for (const path of homePaths) {
      const stats = await PageVisitsModel.getPageVisitCounters(path, days);
      totalVisits += stats.total;
      guestVisits += stats.guest;
      userVisits += stats.user;
    }
    
    ctx.response.status = 200;
    ctx.response.body = { 
      success: true,
      stats: {
        total: totalVisits,
        guest: guestVisits,
        user: userVisits
      }
    };
  } catch (error) {
    console.error(`Error in compatibility getGeneralVisitStats:`, error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Internal server error" };
  }
}

/**
 * COMPATIBILITY: Get home page visit statistics
 * GET /api/page-visits/home-stats
 */
async function compatGetHomePageVisitStats(ctx: RouterContext<string>) {
  try {
    // Default to 30 days
    const days = 30;
    
    // Get visits for home page paths
    const homePaths = ['/', '/index.html', '/index'];
    let totalVisits = 0;
    let guestVisits = 0;
    let userVisits = 0;
    
    // Check if any of the home paths have visits in our counter system
    for (const path of homePaths) {
      const stats = await PageVisitsModel.getPageVisitCounters(path, days);
      totalVisits += stats.total;
      guestVisits += stats.guest;
      userVisits += stats.user;
    }
    
    ctx.response.status = 200;
    ctx.response.body = { 
      success: true,
      stats: {
        total: totalVisits,
        guest: guestVisits,
        user: userVisits
      }
    };
  } catch (error) {
    console.error(`Error in compatibility getHomePageVisitStats:`, error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Internal server error" };
  }
}

// Get (detailed) document visit stats with backward compatibility
router.get("/api/page-visits/documents/:documentId", getDocumentVisitStats);

// Get top visited documents
router.get("/api/page-visits/most-visited-documents", getMostVisitedDocuments);

// Get top visited pages
router.get("/api/page-visits/most-visited-pages", getMostVisitedPages);

// Purge old visit data
router.delete("/api/page-visits/purge", purgeOldVisitData);

// Record a visit
router.post("/api/page-visits", recordPageVisit);

// COMPATIBILITY ROUTES FOR DASHBOARD
// Get most visited documents for dashboard
router.get("/api/most-visited-documents", compatGetMostVisitedDocuments);

// Get visit stats by timeframe for dashboard
router.get("/api/page-visits/stats/:timeframe", compatGetVisitStatsByTimeframe);

// Get general visit statistics
router.get("/api/page-visits/stats", compatGetGeneralVisitStats);

// Get home page visit statistics
router.get("/api/page-visits/home-stats", compatGetHomePageVisitStats);

// Export the router
export const pageVisitsRoutes = router.routes();
export const pageVisitsAllowedMethods = router.allowedMethods(); 