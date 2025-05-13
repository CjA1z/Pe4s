import { Router } from "../deps.ts";
import { 
  getDocumentStatistics,
  exportPdfReport,
  exportCsvReport
} from "../controllers/reportsController.ts";

// Create a simplified stats controller function
async function getSimpleStats(ctx: any) {
  try {
    console.log("Simple statistics endpoint called");
    
    // Connect to the database and run simple queries
    const client = (await import("../db/denopost_conn.ts")).client;
    
    // Query for active documents
    const activeQuery = "SELECT COUNT(*) as count FROM documents WHERE deleted_at IS NULL";
    const activeResult = await client.queryObject(activeQuery);
    const activeCount = activeResult.rows.length > 0 ? Number(activeResult.rows[0].count || 0) : 0;
    
    // Query for archived documents
    const archivedQuery = "SELECT COUNT(*) as count FROM documents WHERE deleted_at IS NOT NULL";
    const archivedResult = await client.queryObject(archivedQuery);
    const archivedCount = archivedResult.rows.length > 0 ? Number(archivedResult.rows[0].count || 0) : 0;
    
    // Calculate total
    const totalCount = activeCount + archivedCount;
    
    // Return a simple response
    ctx.response.body = {
      active_documents: activeCount,
      archived_documents: archivedCount,
      total_documents: totalCount,
      document_types: [],
      time_range: "all"
    };
    ctx.response.status = 200;
    console.log("Simple statistics response sent successfully");
    
  } catch (error) {
    console.error("Error in simple statistics endpoint:", error);
    ctx.response.body = { 
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
    ctx.response.status = 500;
  }
}

const router = new Router();

// Reports API routes
router
  .get("/api/documents/statistics", getDocumentStatistics)
  .get("/api/stats/summary", getSimpleStats)  // Add a new, simpler endpoint
  .post("/api/reports/export-pdf", exportPdfReport)
  .post("/api/reports/export-csv", exportCsvReport);

export default router; 