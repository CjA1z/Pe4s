import { PoolClient } from "../deps.ts";
import { client } from "../db/denopost_conn.ts";

// Define a type for document statistics
interface DocumentStatistics {
  active_documents: number;
  archived_documents: number;
  total_documents: number;
  document_types: Array<{document_type: string; count: number}>;
  time_range: string;
}

// Define a type for row with count
interface CountRow {
  count: string; // PostgreSQL COUNT returns string that needs to be converted
}

// Define a type for query result
interface QueryResult {
  rows: Array<Record<string, unknown>>;
  rowCount: number;
}

/**
 * Get document statistics with time range filtering
 * @param ctx Context object
 */
export async function getDocumentStatistics(ctx: any) {
  try {
    console.log("=== STATISTICS REQUEST RECEIVED ===");
    console.log("Request URL:", ctx.request.url.toString());
    console.log("Request method:", ctx.request.method);
    console.log("Request headers:", JSON.stringify(Object.fromEntries(ctx.request.headers.entries())));
    
    // Get all query parameters
    const queryParams: Record<string, string> = {};
    for (const [key, value] of ctx.request.url.searchParams.entries()) {
      queryParams[key] = value;
    }
    console.log("Query parameters:", JSON.stringify(queryParams));
    
    // Get the time range parameter with better fallback
    let timeRange = "all";
    try {
      timeRange = ctx.request.url.searchParams.get("timeRange") || "all";
      console.log(`Parsed timeRange parameter: ${timeRange}`);
    } catch (paramError) {
      console.error("Error reading timeRange parameter:", paramError);
      // Fall back to default
      timeRange = "all";
    }
    
    console.log(`Fetching document statistics with timeRange: ${timeRange}`);
    
    // Build date criteria based on time range
    let dateCriteria = "";
    let params: any[] = [];
    let startDate = new Date();
    
    if (timeRange !== "all") {
      const now = new Date();
      
      // Set the start date based on the time range
      switch (timeRange) {
        case "daily":
          startDate.setDate(now.getDate() - 1);
          break;
        case "weekly":
          startDate.setDate(now.getDate() - 7);
          break;
        case "monthly":
          startDate.setMonth(now.getMonth() - 1);
          break;
        case "yearly":
          startDate.setFullYear(now.getFullYear() - 1);
          break;
        default:
          // If an invalid time range is provided, default to "all"
          // This prevents issues with unexpected timeRange values
          break;
      }
      
      dateCriteria = "AND (created_at >= $1 OR updated_at >= $1)";
      params.push(startDate.toISOString());
    }
    
    // Simple database connectivity test before running the real queries
    try {
      console.log("Testing database connection...");
      const testResult = await client.queryObject("SELECT 1 as test");
      console.log(`Database connection test successful: ${testResult.rows.length} row(s) returned`);
    } catch (dbTestError) {
      console.error("Database connection test failed:", dbTestError);
      throw new Error("Database connection test failed");
    }
    
    console.log("Building active documents query with criteria:", dateCriteria);
    
    // Query for active documents
    const activeQuery = `
      SELECT COUNT(*) as count
      FROM documents
      WHERE deleted_at IS NULL
      ${dateCriteria}
    `;
    
    console.log("Active documents query:", activeQuery);
    console.log("Query parameters:", params);
    
    // Query for archived documents
    const archivedQuery = `
      SELECT COUNT(*) as count
      FROM documents
      WHERE deleted_at IS NOT NULL
      ${dateCriteria}
    `;
    
    console.log("Archived documents query:", archivedQuery);
    
    // Execute the queries with proper typing and error handling
    let activeCount = 0;
    let archivedCount = 0;
    
    try {
      console.log("Executing active documents query...");
      const activeResult = await client.queryObject(activeQuery, params) as QueryResult;
      console.log("Active result rows:", activeResult.rows.length);
      
      if (activeResult.rows.length > 0) {
        console.log("Active row data:", JSON.stringify(activeResult.rows[0]));
        activeCount = Number(activeResult.rows[0].count || 0);
      }
      console.log("Active count:", activeCount);
    } catch (activeError) {
      console.error("Error executing active documents query:", activeError);
      // Continue with zero count
    }
    
    try {
      console.log("Executing archived documents query...");
      const archivedResult = await client.queryObject(archivedQuery, params) as QueryResult;
      console.log("Archived result rows:", archivedResult.rows.length);
      
      if (archivedResult.rows.length > 0) {
        console.log("Archived row data:", JSON.stringify(archivedResult.rows[0]));
        archivedCount = Number(archivedResult.rows[0].count || 0);
      }
      console.log("Archived count:", archivedCount);
    } catch (archivedError) {
      console.error("Error executing archived documents query:", archivedError);
      // Continue with zero count
    }
    
    // Calculate the total
    const totalCount = activeCount + archivedCount;
    console.log("Total documents count:", totalCount);
    
    // Get document type statistics
    const docTypeQuery = `
      SELECT document_type, COUNT(*) as count
      FROM documents
      WHERE ${timeRange !== "all" ? "(created_at >= $1 OR updated_at >= $1) AND" : ""}
      deleted_at IS NULL
      GROUP BY document_type
    `;
    
    console.log("Document type query:", docTypeQuery);
    
    // Default empty array for document types
    let documentTypes: Array<{document_type: string; count: number}> = [];
    
    try {
      console.log("Executing document types query...");
      const docTypeResult = await client.queryObject(docTypeQuery, 
        timeRange !== "all" ? [startDate.toISOString()] : []) as QueryResult;
      
      console.log("Document types result rows:", docTypeResult.rows.length);
      
      // Parse the document types results
      documentTypes = docTypeResult.rows.map(row => ({
        document_type: String(row.document_type || "unknown"),
        count: Number(row.count || 0)
      }));
      
      console.log("Document types:", JSON.stringify(documentTypes));
    } catch (docTypeError) {
      console.error("Error executing document types query:", docTypeError);
      // Continue with empty array
    }
    
    // Format the response
    const response: DocumentStatistics = {
      active_documents: activeCount,
      archived_documents: archivedCount,
      total_documents: totalCount,
      document_types: documentTypes,
      time_range: timeRange
    };
    
    console.log("Final statistics response:", JSON.stringify(response));
    
    // Return the statistics
    ctx.response.body = response;
    ctx.response.status = 200;
    
  } catch (error: unknown) {
    console.error("Error fetching document statistics:", error);
    ctx.response.body = {
      success: false,
      error: error instanceof Error ? error.message : "Error fetching document statistics"
    };
    ctx.response.status = 500;
  }
}

/**
 * Generate and export PDF report
 * @param ctx Context object
 */
export async function exportPdfReport(ctx: any) {
  try {
    // Get request body
    const body = await ctx.request.body().value;
    
    console.log("Generating PDF report with data:", JSON.stringify(body));
    
    const { reportType, timeRange, data } = body;
    
    // In a real implementation, you would use a PDF generation library
    // For this demo, we'll create a simple PDF with text content
    
    // Mock PDF generation - in a real app you would use a library like PDFKit
    const pdfContent = generateMockPdfContent(reportType, timeRange, data);
    
    // Set response headers for PDF download
    ctx.response.headers.set("Content-Type", "application/pdf");
    ctx.response.headers.set("Content-Disposition", `attachment; filename="archive-report-${timeRange}-${new Date().toISOString().split('T')[0]}.pdf"`);
    
    // Convert string to Uint8Array for response
    const encoder = new TextEncoder();
    ctx.response.body = encoder.encode(pdfContent);
    ctx.response.status = 200;
    
  } catch (error: unknown) {
    console.error("Error generating PDF report:", error);
    ctx.response.body = {
      success: false,
      error: error instanceof Error ? error.message : "Error generating PDF report"
    };
    ctx.response.status = 500;
  }
}

/**
 * Generate and export CSV report
 * @param ctx Context object
 */
export async function exportCsvReport(ctx: any) {
  try {
    // Get request body
    const body = await ctx.request.body().value;
    
    console.log("Generating CSV report with data:", JSON.stringify(body));
    
    const { reportType, timeRange, data } = body;
    
    // Generate CSV content based on report type and data
    let csvContent = "Category,Count,TimeRange\r\n";
    
    if (data) {
      if (data.uploaded !== undefined) {
        csvContent += `Uploaded Documents,${data.uploaded},${timeRange}\r\n`;
      }
      if (data.active !== undefined) {
        csvContent += `Active Documents,${data.active},${timeRange}\r\n`;
      }
      if (data.archived !== undefined) {
        csvContent += `Archived Documents,${data.archived},${timeRange}\r\n`;
      }
    }
    
    // Set response headers for CSV download
    ctx.response.headers.set("Content-Type", "text/csv");
    ctx.response.headers.set("Content-Disposition", `attachment; filename="archive-report-${timeRange}-${new Date().toISOString().split('T')[0]}.csv"`);
    
    // Set the response body
    ctx.response.body = csvContent;
    ctx.response.status = 200;
    
  } catch (error: unknown) {
    console.error("Error generating CSV report:", error);
    ctx.response.body = {
      success: false,
      error: error instanceof Error ? error.message : "Error generating CSV report"
    };
    ctx.response.status = 500;
  }
}

/**
 * Helper function to generate mock PDF content
 * In a real implementation, you would use a PDF generation library
 */
function generateMockPdfContent(reportType: string, timeRange: string, data: any): string {
  // This is a simplified mock - real PDFs are binary files with specific format
  // In production, use a proper PDF generation library
  
  let content = "%PDF-1.4\n";
  content += "1 0 obj\n";
  content += "<< /Type /Catalog /Pages 2 0 R >>\n";
  content += "endobj\n";
  content += "2 0 obj\n";
  content += "<< /Type /Pages /Kids [3 0 R] /Count 1 >>\n";
  content += "endobj\n";
  content += "3 0 obj\n";
  content += "<< /Type /Page /Parent 2 0 R /Resources 4 0 R /MediaBox [0 0 612 792] /Contents 5 0 R >>\n";
  content += "endobj\n";
  content += "4 0 obj\n";
  content += "<< /Font << /F1 6 0 R >> >>\n";
  content += "endobj\n";
  content += "5 0 obj\n";
  content += "<< /Length 171 >>\n";
  content += "stream\n";
  content += "BT\n";
  content += "/F1 24 Tf\n";
  content += "100 700 Td\n";
  content += "(Archive System Report) Tj\n";
  content += "/F1 12 Tf\n";
  content += "0 -50 Td\n";
  content += `(Report Type: ${reportType}) Tj\n`;
  content += "0 -20 Td\n";
  content += `(Time Range: ${timeRange}) Tj\n`;
  content += "0 -20 Td\n";
  
  if (data) {
    if (data.uploaded !== undefined) {
      content += `(Uploaded Documents: ${data.uploaded}) Tj\n`;
      content += "0 -20 Td\n";
    }
    if (data.active !== undefined) {
      content += `(Active Documents: ${data.active}) Tj\n`;
      content += "0 -20 Td\n";
    }
    if (data.archived !== undefined) {
      content += `(Archived Documents: ${data.archived}) Tj\n`;
    }
  }
  
  content += "ET\n";
  content += "endstream\n";
  content += "endobj\n";
  content += "6 0 obj\n";
  content += "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\n";
  content += "endobj\n";
  content += "xref\n";
  content += "0 7\n";
  content += "0000000000 65535 f\n";
  content += "0000000010 00000 n\n";
  content += "0000000059 00000 n\n";
  content += "0000000118 00000 n\n";
  content += "0000000217 00000 n\n";
  content += "0000000262 00000 n\n";
  content += "0000000485 00000 n\n";
  content += "trailer\n";
  content += "<< /Size 7 /Root 1 0 R >>\n";
  content += "startxref\n";
  content += "553\n";
  content += "%%EOF";
  
  return content;
} 