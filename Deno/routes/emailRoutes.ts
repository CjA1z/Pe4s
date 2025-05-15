import { Route } from "./index.ts";
import { RouterContext } from "../deps.ts";
import { sendApprovedRequestEmail, sendRejectedRequestEmail } from "../services/emailService.ts";
import { DocumentModel } from "../models/documentModel.ts";
import { FileCheckService } from "../services/fileCheckService.ts";

/**
 * Send approval email with document attachment
 */
const sendApprovalEmail = async (ctx: RouterContext<any, any, any>) => {
  try {
    const bodyParser = await ctx.request.body({ type: "json" });
    const { email, fullName, documentTitle, documentId } = await bodyParser.value;
    
    console.log(`[EMAIL SERVICE] Processing approval email request for document ID: ${documentId}`);
    console.log(`[EMAIL SERVICE] Request details: recipient=${email}, document="${documentTitle}"`);
    
    // Validate required fields
    if (!email || !documentId) {
      ctx.response.status = 400;
      ctx.response.body = { 
        success: false, 
        message: "Email and documentId are required" 
      };
      return;
    }
    
    // Get the file path from document ID
    console.log(`[EMAIL SERVICE] Retrieving document path for ID: ${documentId}`);
    const documentPath = await DocumentModel.getDocumentPath(documentId);
    
    if (!documentPath) {
      console.error(`[EMAIL SERVICE] Document file not found for ID: ${documentId}`);
      ctx.response.status = 404;
      ctx.response.body = { 
        success: false, 
        message: "Document file not found" 
      };
      return;
    }
    
    console.log(`[EMAIL SERVICE] Found document at path: ${documentPath}`);
    
    // Verify the file exists
    let fileExists = false;
    let fileSize = 0;
    let verificationError = null;
    
    try {
      const fileInfo = await Deno.stat(documentPath);
      fileExists = true;
      fileSize = fileInfo.size;
      console.log(`[EMAIL SERVICE] ✅ File verified: ${documentPath} (${fileInfo.size} bytes)`);
    } catch (error) {
      verificationError = error instanceof Error ? error.message : String(error);
      console.error(`[EMAIL SERVICE] ⚠️ Error accessing file: ${documentPath}`, verificationError);
      console.log(`[EMAIL SERVICE] Will attempt to find file in storage directories`);
      
      // Try to find the file using FileCheckService
      try {
        const fileName = documentPath.split('/').pop() || documentPath.split('\\').pop() || '';
        console.log(`[EMAIL SERVICE] Searching for file name: ${fileName}`);
        
        const results = await FileCheckService.findInStorage(fileName);
        const found = results.filter(r => r.exists);
        
        if (found.length > 0) {
          console.log(`[EMAIL SERVICE] ✅ Found file in storage: ${found[0].path}`);
          fileExists = true;
        } else {
          console.log(`[EMAIL SERVICE] ❌ File not found in any storage location`);
        }
      } catch (searchError) {
        console.error(`[EMAIL SERVICE] Error during file search:`, searchError);
      }
    }
    
    // Send the email with attachment
    console.log(`[EMAIL SERVICE] Sending approval email with document attachment to ${email}`);
    const success = await sendApprovedRequestEmail(
      email,
      fullName || "User",
      documentTitle || "Requested Document",
      documentPath
    );
    
    if (success) {
      console.log(`[EMAIL SERVICE] ✅ Document successfully sent to ${email}`);
      ctx.response.body = { 
        success: true, 
        message: "Approval email sent successfully",
        documentPath: documentPath,
        fileExists: fileExists,
        fileSize: fileSize,
        verificationError: verificationError,
        recipient: email
      };
    } else {
      console.error(`[EMAIL SERVICE] Failed to send approval email to ${email}`);
      ctx.response.status = 500;
      ctx.response.body = { 
        success: false, 
        message: "Failed to send approval email",
        documentPath: documentPath,
        fileExists: fileExists,
        verificationError: verificationError
      };
    }
  } catch (error: unknown) {
    console.error("Error in sendApprovalEmail:", error instanceof Error ? error.message : String(error));
    ctx.response.status = 500;
    ctx.response.body = { 
      success: false, 
      message: "Server error while sending email", 
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

/**
 * Send rejection email
 */
const sendRejectionEmail = async (ctx: RouterContext<any, any, any>) => {
  try {
    const bodyParser = await ctx.request.body({ type: "json" });
    const { email, fullName, documentTitle, reason } = await bodyParser.value;
    
    // Validate required fields
    if (!email || !reason) {
      ctx.response.status = 400;
      ctx.response.body = { 
        success: false, 
        message: "Email and reason are required" 
      };
      return;
    }
    
    // Send the rejection email
    const success = await sendRejectedRequestEmail(
      email,
      fullName || "User",
      documentTitle || "Requested Document",
      reason
    );
    
    if (success) {
      ctx.response.body = { 
        success: true, 
        message: "Rejection email sent successfully" 
      };
    } else {
      ctx.response.status = 500;
      ctx.response.body = { 
        success: false, 
        message: "Failed to send rejection email" 
      };
    }
  } catch (error: unknown) {
    console.error("Error in sendRejectionEmail:", error);
    ctx.response.status = 500;
    ctx.response.body = { 
      success: false, 
      message: "Server error while sending email", 
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

/**
 * Check if document files exist and can be sent
 */
const checkDocumentFiles = async (ctx: RouterContext<any, any, any>) => {
  try {
    const bodyParser = await ctx.request.body({ type: "json" });
    const { documentId } = await bodyParser.value;
    
    if (!documentId) {
      ctx.response.status = 400;
      ctx.response.body = { 
        success: false, 
        message: "Document ID is required" 
      };
      return;
    }
    
    console.log(`[FILE CHECK API] Checking document files for ID: ${documentId}`);
    
    // Get the document path from the database
    const dbPath = await DocumentModel.getDocumentPath(documentId);
    
    if (!dbPath) {
      ctx.response.status = 404;
      ctx.response.body = { 
        success: false, 
        message: "No file path found in database for this document"
      };
      return;
    }
    
    // Extract the filename from the path
    const fileName = dbPath.split('/').pop() || dbPath.split('\\').pop() || '';
    
    // Check all possible storage locations
    const results = await FileCheckService.findInStorage(fileName);
    
    // Find any existing files
    const foundFiles = results.filter(r => r.exists);
    
    ctx.response.body = {
      success: true,
      documentId,
      databasePath: dbPath,
      fileName,
      results,
      foundCount: foundFiles.length,
      foundFiles: foundFiles
    };
  } catch (error: unknown) {
    console.error("Error in checkDocumentFiles:", error instanceof Error ? error.message : String(error));
    ctx.response.status = 500;
    ctx.response.body = { 
      success: false, 
      message: "Server error while checking files", 
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

// Export email routes
export const emailRoutes: Route[] = [
  { method: "POST", path: "/api/email/send-approval", handler: sendApprovalEmail },
  { method: "POST", path: "/api/email/send-rejection", handler: sendRejectionEmail },
  { method: "POST", path: "/api/email/check-document-files", handler: checkDocumentFiles }
]; 