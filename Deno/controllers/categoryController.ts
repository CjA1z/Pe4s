import { Context } from "https://deno.land/x/oak/mod.ts";
import { client } from "../db/denopost_conn.ts";

// Interface for a category with a document count
interface CategoryWithCount {
  name: string;
  count: number;
}

/**
 * Get all categories with document counts
 */
export async function getCategories(ctx: Context) {
  try {
    console.log("Getting categories with document counts including compiled documents");
    
    // First attempt: Just return a simple list of known categories
    const knownCategories = [
      { name: "THESIS", count: 0 }, 
      { name: "DISSERTATION", count: 0 },
      { name: "CONFLUENCE", count: 0 },
      { name: "SYNERGY", count: 0 }
    ];
    
    // Try to get actual counts with queries that include compiled documents
    try {
      // Get total count of regular documents (not child documents)
      const regularCount = await client.queryObject(`
        SELECT COUNT(*) as count FROM documents 
        WHERE deleted_at IS NULL 
        AND compiled_parent_id IS NULL
      `);
      
      // Get total count of compiled documents
      const compiledCount = await client.queryObject(`
        SELECT COUNT(*) as count FROM compiled_documents 
        WHERE deleted_at IS NULL
      `);
      
      // Attempt to get document type distribution for regular documents
      const categoryQuery = `
        SELECT document_type, COUNT(*) as count 
        FROM documents 
        WHERE deleted_at IS NULL 
        AND compiled_parent_id IS NULL
        GROUP BY document_type
      `;
      
      const categoryResults = await client.queryObject(categoryQuery);
      
      // Update category counts based on query results for regular documents
      if (categoryResults.rows) {
        for (const row of categoryResults.rows) {
          const docType = (row as {document_type: string}).document_type;
          const count = Number((row as {count: number}).count);
          
          // Find and update matching category
          for (const category of knownCategories) {
            if (category.name === docType) {
              category.count = count;
              break;
            }
          }
        }
      }
      
      // Now get the compiled document counts by category
      const compiledCategoryQuery = `
        SELECT category, COUNT(*) as count 
        FROM compiled_documents 
        WHERE deleted_at IS NULL
        GROUP BY category
      `;
      
      const compiledCategoryResults = await client.queryObject(compiledCategoryQuery);
      
      // Add compiled document counts to the appropriate categories
      if (compiledCategoryResults.rows) {
        for (const row of compiledCategoryResults.rows) {
          const category = (row as {category: string}).category;
          const count = Number((row as {count: number}).count);
          
          if (!category) continue;
          
          // Find and update matching category (case insensitive)
          for (const knownCat of knownCategories) {
            if (knownCat.name.toUpperCase() === category.toUpperCase() || 
                category.toUpperCase().includes(knownCat.name.toUpperCase())) {
              knownCat.count += count;
              console.log(`Added ${count} compiled documents to ${knownCat.name}, new total: ${knownCat.count}`);
              break;
            }
          }
        }
      }
      
      console.log("Successfully fetched category counts including compiled documents");
    } catch (dbError) {
      console.error("Database error getting category counts:", dbError);
      // Continue with hardcoded values if necessary
    }
    
    // Return the categories
    ctx.response.body = knownCategories;
  } catch (error) {
    console.error("Error fetching categories:", error);
    ctx.response.status = 500;
    ctx.response.body = { 
      error: "Failed to fetch categories",
      details: error instanceof Error ? error.message : String(error)
    };
  }
} 