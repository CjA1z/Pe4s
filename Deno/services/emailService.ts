/**
 * Email Service
 * Handles sending emails, including those with attachments
 */

import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { ensureDir } from "https://deno.land/std@0.190.0/fs/ensure_dir.ts";
import { join } from "../deps.ts";
import { FileCheckService } from './fileCheckService.ts';
import { encode as encodeBase64 } from "https://deno.land/std@0.190.0/encoding/base64.ts";

// After loading .env file, add debugging output
try {
  const dotenv = await import("https://deno.land/x/dotenv@v3.2.2/mod.ts");
  // Try multiple possible locations for the .env file
  try { await dotenv.config({ path: "./.env", export: true }); } catch (_) { /* ignore */ }
  try { await dotenv.config({ path: "../.env", export: true }); } catch (_) { /* ignore */ }
  try { await dotenv.config({ path: "../../.env", export: true }); } catch (_) { /* ignore */ }
  try { await dotenv.config({ path: "./Deno/.env", export: true }); } catch (_) { /* ignore */ }
  console.log("[EMAIL] Attempted to load .env file from multiple locations");
  
  // Add debugging output to verify if environment variables are loaded
  console.log("[EMAIL] Environment variables after loading .env:");
  console.log("[EMAIL] SMTP_USERNAME:", Deno.env.get("SMTP_USERNAME") || "Not set");
  console.log("[EMAIL] SMTP_PASSWORD exists:", !!Deno.env.get("SMTP_PASSWORD"));
} catch (error: unknown) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error("[EMAIL] Error loading .env file:", errorMessage);
}

// Email configuration using environment variables with fallbacks for development
const EMAIL_CONFIG = {
  hostname: "smtp.gmail.com", // Clean hostname without comments
  port: parseInt(Deno.env.get("SMTP_PORT") || "465"),
  // For quick fix, replace these with your actual Gmail credentials
  // IMPORTANT: This is a temporary solution - move to environment variables as soon as possible!
  username: Deno.env.get("SMTP_USERNAME") || "speasspup@gmail.com", // Using previous working email
  password: Deno.env.get("SMTP_PASSWORD") || "ynhdddlnkuemhmkr", // Using previous working password
  useTLS: Deno.env.get("SMTP_TLS") !== "false",    // True by default
  connectTimeout: 30000, // 30 seconds timeout for connection
  sendTimeout: 60000,    // 60 seconds timeout for sending operations
  retryAttempts: 2,      // Retry attempts on connection failure
  maxRetries: 3,         // Maximum retries for any operation
};

// Configure email fallbacks
let emailServiceAvailable = true;      // Flag to track if email service is working
let lastEmailAttemptTime = 0;          // Track the last time we tried to send email
const emailRetryInterval = 5 * 60000;  // 5 minutes in milliseconds before trying again
const maxConsecutiveFailures = 3;      // After this many failures, wait for retry interval
let consecutiveFailures = 0;           // Track consecutive failures

// Fix for from address format
const getFormattedFromAddress = () => {
  const username = EMAIL_CONFIG.username;
  // Ensure username is a valid email address
  if (!username || !username.includes('@')) {
    console.error('[SMTP] Invalid SMTP_USERNAME format. Must be a valid email address.');
    // Return a placeholder that's properly formatted but will fail auth
    return 'noreply@example.com';
  }
  
  // Ensure the from address follows RFC 5322 format
  if (username.includes('<') && username.includes('>')) {
    // Already properly formatted
    return username;
  } else {
    // Use a properly formatted RFC 5322 address with name and email
    return `"sPeAS System" <${username}>`;
  }
};

// Validate email configuration on initialization
(() => {
  const problems = [];
  
  if (!EMAIL_CONFIG.username) problems.push("SMTP_USERNAME environment variable is not set");
  if (!EMAIL_CONFIG.password) problems.push("SMTP_PASSWORD environment variable is not set");
  if (!EMAIL_CONFIG.username?.includes('@')) problems.push("SMTP_USERNAME is not a valid email address (must include @)");
  
  if (problems.length > 0) {
    console.error("⚠️ [SMTP] EMAIL CONFIGURATION PROBLEMS DETECTED:");
    problems.forEach(problem => console.error(`  - ${problem}`));
    console.error("Email functionality will not work until these issues are fixed.");
  }
})();

// Log current email configuration (with password masked)
console.log("[EMAIL CONFIG] Host:", EMAIL_CONFIG.hostname);
console.log("[EMAIL CONFIG] Port:", EMAIL_CONFIG.port);
console.log("[EMAIL CONFIG] Username:", EMAIL_CONFIG.username ? EMAIL_CONFIG.username : "Not set");
console.log("[EMAIL CONFIG] Password set:", EMAIL_CONFIG.password ? "Yes" : "No");
console.log("[EMAIL CONFIG] TLS enabled:", EMAIL_CONFIG.useTLS);

// Log a warning if credentials are missing
if (!EMAIL_CONFIG.username || !EMAIL_CONFIG.password) {
  console.warn("WARNING: Email credentials not configured. Set SMTP_USERNAME and SMTP_PASSWORD environment variables.");
}

// Initialize SMTP client
let smtpClient: SMTPClient | null = null;

// Add file existence verification and debug mode to the email service
const DEBUG_MODE = true; // Enable more verbose debugging

/**
 * Initializes the SMTP client with the provided configuration
 */
function initializeClient() {
  // Don't attempt to initialize if we've determined service is unavailable recently
  const currentTime = Date.now();
  if (!emailServiceAvailable && (currentTime - lastEmailAttemptTime) < emailRetryInterval) {
    console.log("[SMTP] Skipping connection attempt - service marked unavailable recently");
    return null;
  }
  
  lastEmailAttemptTime = currentTime;
  
  if (!smtpClient) {
    try {
      if (!EMAIL_CONFIG.username || !EMAIL_CONFIG.password) {
        console.error("[SMTP] Email credentials not configured");
        emailServiceAvailable = false;
        return null;
      }
      
      console.log("[SMTP] Initializing SMTP client...");
      
      smtpClient = new SMTPClient({
        connection: {
          hostname: EMAIL_CONFIG.hostname,
          port: EMAIL_CONFIG.port,
          tls: EMAIL_CONFIG.useTLS,
          auth: {
            username: EMAIL_CONFIG.username,
            password: EMAIL_CONFIG.password,
          }
        },
        // Add debug option with correct type
        debug: { log: true },
      });
      console.log("[SMTP] SMTP client initialized successfully");
      emailServiceAvailable = true;
      return smtpClient;
    } catch (error) {
      console.error("[SMTP] Error initializing SMTP client:", error);
      emailServiceAvailable = false;
      return null;
    }
  }
  
  return smtpClient;
}

/**
 * Logs email activity to a file for tracking purposes
 * @param action The action being performed
 * @param details Details about the email
 */
async function logEmailActivity(action: string, details: Record<string, any>): Promise<void> {
  try {
    // Ensure logs directory exists
    await ensureDir("./logs");
    
    const now = new Date();
    const timestamp = now.toISOString();
    const date = now.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    // Create a log entry
    const logEntry = {
      timestamp,
      action,
      ...details
    };
    
    // Format log message
    const logMessage = JSON.stringify(logEntry) + "\n";
    
    // Append to daily log file
    const logFile = `./logs/email-activity-${date}.log`;
    
    await Deno.writeTextFile(logFile, logMessage, { append: true })
      .catch(async (err) => {
        // If file doesn't exist, create it
        if (err instanceof Deno.errors.NotFound) {
          await Deno.writeTextFile(logFile, logMessage);
        } else {
          throw err;
        }
      });
      
    console.log(`[SMTP] Activity logged to ${logFile}`);
  } catch (error) {
    // Don't fail the main operation if logging fails
    console.error("[SMTP] Error logging activity:", error);
  }
}

// Add a new function to detect file types
/**
 * Detects the MIME type of a file based on its header bytes
 * @param filePath Path to the file
 * @returns Promise resolving to the MIME type string
 */
async function getFileType(filePath: string): Promise<string> {
  try {
    // Read first 4 bytes of file to determine type
    const file = await Deno.open(filePath, { read: true });
    const buffer = new Uint8Array(4);
    await file.read(buffer);
    file.close();
    
    // Check for PDF signature: %PDF (25 50 44 46)
    if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
      return "application/pdf";
    }
    
    // Check for common document formats
    // Office formats often start with PK (zip files)
    if (buffer[0] === 0x50 && buffer[1] === 0x4B) {
      if (filePath.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      if (filePath.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      if (filePath.endsWith(".pptx")) return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    }
    
    // Default to checking file extension
    if (filePath.toLowerCase().endsWith(".pdf")) return "application/pdf";
    if (filePath.toLowerCase().endsWith(".doc")) return "application/msword";
    if (filePath.toLowerCase().endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (filePath.toLowerCase().endsWith(".txt")) return "text/plain";
    
    return "application/octet-stream"; // Default binary type
  } catch (error) {
    console.error(`[SMTP] Error detecting file type: ${error}`);
    // If we can't detect the type but the file has a .pdf extension, assume it's a PDF
    if (filePath.toLowerCase().endsWith(".pdf")) {
      return "application/pdf";
    }
    return "application/octet-stream";
  }
}

// Fix the encoding function to properly handle binary data in Deno
async function encodeFileForEmail(filePath: string): Promise<{
  content: string;
  size: number;
}> {
  console.log(`[SMTP] 📤 Reading file for email encoding: ${filePath}`);
  
  // Check file stats before reading
  const fileStats = await Deno.stat(filePath);
  if (fileStats.size === 0) {
    console.error(`[SMTP] ❌ File exists but is empty (0 bytes): ${filePath}`);
    throw new Error("File exists but is empty (0 bytes)");
  }
  
  console.log(`[SMTP] File stats before encoding: Size=${fileStats.size} bytes, isFile=${fileStats.isFile}, Modified=${fileStats.mtime}`);
  
  // Read file as binary
  const fileBytes = await Deno.readFile(filePath);
  
  // Use the standard Deno base64 encoder instead of custom implementation
  const base64Content = encodeBase64(fileBytes);
  console.log(`[SMTP] File encoded successfully: Original size=${fileStats.size} bytes, Encoded size=${base64Content.length} chars`);
  
  return {
    content: base64Content,
    size: fileStats.size
  };
}

// Helper function to encode binary data to base64
function encode(data: Uint8Array): string {
  try {
    return encodeBase64(data);
  } catch (e) {
    // Fallback method if the standard library function fails
    console.error("Error using standard base64 encoding, falling back to manual encoding:", e);
    
    // Convert binary data to a format that btoa can handle
    const binary = Array.from(new Uint8Array(data))
      .map(byte => String.fromCharCode(byte))
      .join("");
      
    return btoa(binary);
  }
}

// Add direct logging to verify message structure before sending
async function logMessageStructure(message: any, prefix = "[DEBUG]") {
  console.log(`${prefix} Message structure before sending:`);
  console.log(`${prefix} From: ${message.from}`);
  console.log(`${prefix} To: ${message.to}`);
  console.log(`${prefix} Subject: ${message.subject}`);
  console.log(`${prefix} Has HTML: ${!!message.html}`);
  
  if (message.attachments && message.attachments.length > 0) {
    console.log(`${prefix} Attachments: ${message.attachments.length}`);
    for (let i = 0; i < message.attachments.length; i++) {
      const att = message.attachments[i];
      console.log(`${prefix} - Attachment ${i+1}:`);
      console.log(`${prefix}   Filename: ${att.filename}`);
      console.log(`${prefix}   Content type: ${att.contentType}`);
      console.log(`${prefix}   Encoding: ${att.encoding}`);
      console.log(`${prefix}   Content length: ${typeof att.content === 'string' ? att.content.length : (att.content instanceof Uint8Array ? att.content.length : 'unknown')} bytes/chars`);
    }
  } else {
    console.log(`${prefix} No attachments found in message!`);
  }
}

/**
 * Decodes a base64 string to a Uint8Array
 * @param base64 - The base64 string to decode
 * @returns Uint8Array of decoded bytes
 */
function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Converts a Uint8Array to a base64 string
 * @param bytes - The Uint8Array to convert
 * @returns Base64 encoded string
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Sends an email with an attachment
 * @param to Recipient email address
 * @param subject Email subject
 * @param text Plain text content
 * @param html HTML content (optional)
 * @param filePath Path to the file to attach (optional)
 * @param fileName Name to display for the attachment (optional)
 * @returns Promise that resolves to an object with email sending status and attachment info
 */
export async function sendEmailWithAttachment(
  to: string,
  subject: string,
  text: string,
  html?: string,
  filePath?: string,
  fileName?: string
): Promise<any> {
  try {
    console.log(`[SMTP] Initializing email client for sending to: ${to}`);
    
    // Check if email configuration is valid before attempting to initialize
    if (!EMAIL_CONFIG.username || !EMAIL_CONFIG.password) {
      console.error("[SMTP] Cannot send email: SMTP credentials not configured");
      await logEmailActivity("EMAIL_CONFIG_ERROR", {
        recipient: to,
        subject: subject,
        error: "SMTP credentials not configured"
      });
      return {
        success: false,
        error: "SMTP credentials not configured. Check environment variables.",
        attachment_success: false
      };
    }
    
    if (!EMAIL_CONFIG.username.includes('@')) {
      console.error("[SMTP] Cannot send email: SMTP username is not a valid email address");
      await logEmailActivity("EMAIL_CONFIG_ERROR", {
        recipient: to,
        subject: subject,
        error: "SMTP username is not a valid email address"
      });
      return {
        success: false,
        error: "SMTP username is not a valid email address. Must include @.",
        attachment_success: false
      };
    }
    
    // Try to initialize the SMTP client
    try {
    initializeClient();
    } catch (initError) {
      console.error("[SMTP] Failed to initialize SMTP client:", initError);
      await logEmailActivity("EMAIL_INIT_ERROR", {
        recipient: to,
        subject: subject,
        error: initError instanceof Error ? initError.message : String(initError)
      });
      return {
        success: false,
        error: initError instanceof Error ? initError.message : String(initError),
        attachment_success: false
      };
    }
    
    if (!smtpClient) {
      console.error("[SMTP] Failed to initialize SMTP client");
      return {
        success: false,
        error: "Failed to initialize SMTP client",
        attachment_success: false
      };
    }

    // Create message using our helper
    const message = {
      from: getFormattedFromAddress(),
      to: to,
      subject: subject,
      text: text,
      html: html,
      attachments: []
    };
    
    // Track attachment details for response
    let attachmentInfo: {
      attached: boolean;
      path: string | null;
      size: number;
      error: string | null;
      fileType?: string;
    } = {
      attached: false,
      path: filePath || null,
      size: 0,
      error: null
    };
    
    // Add attachment if provided
    if (filePath) {
      try {
        console.log(`[SMTP] 📎 Attempting to attach file from path: ${filePath}`);
        console.log(`[SMTP DEBUG] Current working directory: ${Deno.cwd()}`);
        
        // Enhanced file existence check
        let fileExists = false;
        let foundFileSize = 0;
        let fileError = null;
        let finalPath = filePath;
        
        try {
          const fileInfo = await Deno.stat(filePath);
          fileExists = true;
          foundFileSize = fileInfo.size;
          attachmentInfo.size = fileInfo.size;
          console.log(`[SMTP] ✅ Verified document exists: ${filePath} (${fileInfo.size} bytes)`);
        } catch (directPathError) {
          console.log(`[SMTP] ⚠️ Document not found at direct path: ${filePath}`);
          fileError = directPathError instanceof Error ? directPathError.message : String(directPathError);
          attachmentInfo.error = fileError;
          
          // Try to find the file using the FileCheckService
          try {
            // Get file name from path
            const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || '';
            
            if (fileName) {
              console.log(`[SMTP] Searching for document "${fileName}" in storage directories...`);
              
              // Import dynamically to avoid circular dependency
              const { FileCheckService } = await import('./fileCheckService.ts');
              const results = await FileCheckService.findInStorage(fileName);
              
              // Find any successful matches
              const found = results.filter(r => r.exists);
              
              if (found.length > 0) {
                console.log(`[SMTP] ✅ Found document in ${found.length} location(s):`);
                found.forEach((result, i) => {
                  console.log(`  ${i+1}. ${result.path} (${result.size} bytes)`);
                });
                
                // Use the first found file
                finalPath = found[0].path;
                    fileExists = true;
                foundFileSize = found[0].size || 0;
                attachmentInfo.path = finalPath;
                attachmentInfo.size = foundFileSize;
              } else {
                console.error(`[SMTP] ❌ Document not found in any storage location`);
                await logEmailActivity("DOCUMENT_NOT_FOUND", {
                  recipient: to,
                  document: subject,
                  document_path: filePath,
                  error: "File not found in any storage location"
                });
              }
            }
          } catch (searchError) {
            console.error(`[SMTP] Error searching for document:`, searchError);
            attachmentInfo.error = searchError instanceof Error ? searchError.message : String(searchError);
          }
        }
        
        if (!fileExists) {
          console.error(`[SMTP] ❌ File does not exist at any tried path. Cannot attach file to email.`);
          console.log(`[SMTP] ⚠️ Will continue sending email without attachment`);
          console.log(`[FILE NOT SENT] ⚠️⚠️⚠️ FILE ATTACHMENT FAILED - FILE NOT FOUND: ${filePath}`);
          
          await logEmailActivity("FILE_ATTACHMENT_FAILED", {
            file_path: filePath,
            error: "File does not exist at any tried path",
            to: to,
            subject: subject
          });
        } else {
          // File exists, validate file type before attaching
          const fileType = await getFileType(finalPath);
          attachmentInfo.fileType = fileType;
          
          // Define allowed file types (primarily PDFs, but with some flexibility)
          const allowedTypes = [
            'application/pdf', 
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          ];
          
          console.log(`[SMTP] File type detected: ${fileType}`);

          if (!allowedTypes.includes(fileType) && 
              !fileType.includes('pdf') && 
              !finalPath.toLowerCase().endsWith('.pdf')) {
            console.error(`[SMTP] ❌ Invalid file type: ${fileType}. Only PDF documents are allowed.`);
            
            await logEmailActivity("INVALID_FILE_TYPE", {
              file_path: finalPath,
              file_type: fileType,
              to: to,
              subject: subject
            });
            
            attachmentInfo.error = `Invalid file type: ${fileType}. Only PDF documents are allowed.`;
            
            // Continue sending email without attachment
            console.log(`[SMTP] ⚠️ Will continue sending email without attachment due to invalid file type`);
            
            return {
              success: true, // Email will still be sent
              attachment_success: false,
              fileExists: true,
              fileType: fileType,
              documentPath: finalPath,
              error: `Invalid file type: ${fileType}. Only PDF documents are allowed.`
            };
          }
          
          // File exists and is valid, read and attach it
          try {
            console.log(`[SMTP] 📤 Reading file directly for attachment: ${finalPath}`);
            
            // Check if file exists and its size
            const fileInfo = await Deno.stat(finalPath);
            
            if (fileInfo.size === 0) {
              throw new Error(`File exists but is empty (0 bytes): ${finalPath}`);
            }
            
            console.log(`[SMTP] File exists, size: ${fileInfo.size} bytes`);
            
            // Read the file directly as binary data
            const fileContent = await Deno.readFile(finalPath);
            console.log(`[SMTP] File read successfully, content length: ${fileContent.length} bytes`);
            
            // Convert to base64
            const base64Content = uint8ArrayToBase64(fileContent);
            console.log(`[SMTP] File encoded to base64, length: ${base64Content.length} chars`);
            
            // Add attachment directly (simpler approach)
            message.attachments = [{
              filename: fileName || finalPath.split('/').pop() || finalPath.split('\\').pop() || 'attachment.pdf',
              content: base64Content,
              contentType: fileType || 'application/pdf',
              encoding: 'base64'
            }] as any; // Use type assertion to bypass the type checking
            
            console.log(`[SMTP] Attachment added to message with content length: ${base64Content.length}`);
            
            // Log message structure to verify attachment was added properly
            await logMessageStructure(message, "[SMTP]");
            
            attachmentInfo.attached = true;
            attachmentInfo.size = fileInfo.size;
            
            console.log(`[SMTP] ✅ Attachment added to email (${fileInfo.size} bytes)`);
            console.log(`[SMTP] ✅✅✅ FILE SUCCESSFULLY READ AND ATTACHED: ${fileName || finalPath.split('/').pop() || finalPath.split('\\').pop() || 'attachment'} (${fileInfo.size} bytes)`);
          } catch (error) {
            console.error(`[SMTP] ❌ Error reading/attaching file: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      } catch (fileError) {
        console.error(`[SMTP] ❌ Error processing attachment ${filePath}:`, fileError);
        // Continue sending email without attachment
        console.log(`[SMTP] ⚠️ Will continue sending email without attachment`);
        console.log(`[FILE NOT SENT] ⚠️⚠️⚠️ GENERAL ATTACHMENT ERROR: ${fileError instanceof Error ? fileError.message : String(fileError)}`);
        
        attachmentInfo.error = fileError instanceof Error ? fileError.message : String(fileError);
        
        await logEmailActivity("FILE_ATTACHMENT_FAILED", {
          file_path: filePath,
          error: fileError instanceof Error ? fileError.message : String(fileError),
          stage: "general_error",
          to: to
        });
      }
    }
    
    // Verify message has attachments if they were expected
    if (filePath && (!message.attachments || message.attachments.length === 0)) {
      console.error(`[SMTP] ❌ CRITICAL ERROR: Attachment was expected but not found in message before sending!`);
      
      // Try to add attachment one more time directly
      try {
        const fileContent = await Deno.readFile(filePath);
        const base64Content = uint8ArrayToBase64(fileContent);
        message.attachments = [{
          filename: fileName || filePath.split('/').pop() || filePath.split('\\').pop() || 'document.pdf',
          content: base64Content,
          contentType: 'application/pdf',
          encoding: 'base64',
          contentDisposition: 'attachment',
          headers: {
            'Content-Transfer-Encoding': 'base64',
            'Content-Type': 'application/pdf'
          }
        }] as any;
        
        console.log(`[SMTP] Re-added attachment as last resort (${fileContent.length} bytes)`);
        
        // Log the final message structure
        await logMessageStructure(message, "[SMTP FINAL]");
      } catch (lastError) {
        console.error(`[SMTP] Failed last attempt to add attachment:`, lastError);
      }
    }
    
    // Send the email with better error handling
    try {
    console.log(`[SMTP] Sending email to ${to} with subject "${subject}"${filePath && message.attachments ? ' including attachment' : ' WITHOUT attachment'}`);
    
    // Initialize the SMTP client before attempting to send
    const client = initializeClient();
    if (!client) {
      console.error("[SMTP] Failed to initialize SMTP client");
      throw new Error("Failed to initialize SMTP client. Check your email settings.");
    }
    
    await client.send(message);
    console.log(`[SMTP] ✅ Email successfully sent to ${to} with subject "${subject}"`);
    
    // Log clear confirmation about attachment status
    if (filePath && message.attachments) {
      console.log(`[FILE SENT SUCCESSFULLY] ✅✅✅ THE FILE WAS SUCCESSFULLY SENT TO ${to}`);
    } else if (filePath && !message.attachments) {
      console.log(`[FILE NOT SENT] ⚠️⚠️⚠️ EMAIL WAS SENT BUT FILE WAS NOT ATTACHED TO ${to}`);
    }
    
      // Return detailed status
      return {
        success: true,
        attachment_success: attachmentInfo.attached,
        fileExists: attachmentInfo.attached,
        documentPath: attachmentInfo.path,
        fileSize: attachmentInfo.size,
        fileType: attachmentInfo.fileType,
        error: null
      };
    } catch (sendError) {
      // Handle specific error types
      const errorMessage = sendError instanceof Error ? sendError.message : String(sendError);
      
      let friendlyError = "Unknown email error";
      
      // Check for common SMTP errors
      if (errorMessage.includes("535") || errorMessage.includes("Username and Password not accepted")) {
        friendlyError = "Authentication failed. Please check your email username and password.";
      } else if (errorMessage.includes("Connection refused") || errorMessage.includes("ECONNREFUSED")) {
        friendlyError = "Connection to email server refused. Check server settings and firewall.";
      } else if (errorMessage.includes("timeout")) {
        friendlyError = "Connection to email server timed out. Check network settings.";
      } else if (errorMessage.includes("certificate")) {
        friendlyError = "SSL/TLS certificate error. Check your security settings.";
      } else {
        friendlyError = `Email error: ${errorMessage}`;
      }
      
      console.error("[SMTP] Error sending email:", sendError);
      console.error("[SMTP] Friendly error message:", friendlyError);
      
    await logEmailActivity("EMAIL_SEND_ERROR", {
        recipient: to,
        subject: subject,
        error: errorMessage,
        friendly_error: friendlyError,
        error_stack: sendError instanceof Error ? sendError.stack : 'No stack trace'
      });
      
      return {
        success: false,
        error: friendlyError,
        documentPath: attachmentInfo.path,
        fileExists: attachmentInfo.attached,
        fileSize: attachmentInfo.size,
        attachment_success: attachmentInfo.attached
      };
    }
  } catch (error) {
    console.error("[SMTP] Unexpected error in email service:", error);
    await logEmailActivity("EMAIL_UNEXPECTED_ERROR", {
      recipient: to,
      subject: subject,
      error: error instanceof Error ? error.message : String(error),
      error_stack: error instanceof Error ? error.stack : 'No stack trace'
    });
    
    return {
      success: false,
      error: "Unexpected error in email service. See logs for details.",
      documentPath: attachmentInfo.path,
      fileExists: attachmentInfo.attached,
      fileSize: attachmentInfo.size,
      attachment_success: attachmentInfo.attached
    };
  }
}

/**
 * Sends an email notification when a document request is approved with the document attached
 * @param email Recipient email
 * @param fullName Recipient's name
 * @param documentTitle Title of the document
 * @param documentFilePath Path to the document file
 * @param requestId Unique ID assigned to the request
 * @param documentAuthor Author of the document
 * @param documentCategory Category of the document
 * @param documentKeywords Keywords associated with the document
 * @param childDocumentPaths Array of paths to child documents (for compiled documents)
 * @returns Promise resolving to object with email sending results
 */
export async function sendApprovedRequestEmail(
  email: string,
  fullName: string,
  documentTitle: string,
  documentFilePath: string,
  requestId?: string,
  documentAuthor?: string | null,
  documentCategory?: string | null,
  documentKeywords?: string | null,
  childDocumentPaths?: string[]
): Promise<boolean | {
  success: boolean;
  documentPath: string;
  fileExists: boolean;
  fileSize: number;
  attachment_success: boolean;
  error?: string;
}> {
  console.log(`[SMTP] Preparing approval email for document: "${documentTitle}"`);
  console.log(`[SMTP] Document path: ${documentFilePath}`);
  console.log(`[SMTP] Child document paths: ${childDocumentPaths?.length || 0}`);
  
  // Log the beginning of this activity
  await logEmailActivity("DOCUMENT_APPROVAL_START", {
    recipient: email,
    documentTitle,
    documentPath: documentFilePath,
    childDocumentCount: childDocumentPaths?.length || 0
  });

  try {
    // CRITICAL FIX: Add direct PDF handling right at the start
    console.log("[SMTP APPROVAL] Attempting direct PDF read for attachments");
    let mainPdfContent: Uint8Array | null = null;
    let childPdfContents: Array<{path: string, content: Uint8Array}> = [];
    let fileSize = 0;
    let fileExists = false;
    let successfulAttachments = 0;
    
    // Try multiple paths for the main document
    if (documentFilePath) {
    const pathsToTry = [
      documentFilePath,
        `./Public/documents/${documentFilePath}`,
      `./documents/${documentFilePath}`,
        `./uploads/${documentFilePath}`,
        `./Public/uploads/${documentFilePath}`,
        `./storage/${documentFilePath}`,
        `./Public/storage/${documentFilePath}`,
        // Additional paths to try
        `${Deno.cwd()}/Public/documents/${documentFilePath}`,
        `${Deno.cwd()}/documents/${documentFilePath}`,
        `${Deno.cwd()}/uploads/${documentFilePath}`,
        `${Deno.cwd()}/storage/${documentFilePath}`,
        // Try with Document ID instead of path
        `./storage/thesis/${documentFilePath}`,
        `./storage/dissertation/${documentFilePath}`,
        `./storage/confluence/${documentFilePath}`,
        `./storage/synergy/${documentFilePath}`,
        `./Public/documents/thesis/${documentFilePath}`,
        `./Public/documents/dissertation/${documentFilePath}`
    ];
    
      console.log(`[SMTP ATTACHMENT DEBUG] Searching for document: ${documentFilePath}`);
      console.log(`[SMTP ATTACHMENT DEBUG] Current working directory: ${Deno.cwd()}`);
    
      // Try to list files in storage directory to help debug
      try {
        console.log(`[SMTP ATTACHMENT DEBUG] Listing available files in storage:`);
        const storageFiles = [];
        for await (const entry of Deno.readDir('./storage')) {
          storageFiles.push(entry.name);
        }
        console.log(`[SMTP ATTACHMENT DEBUG] Files in storage: ${storageFiles.join(', ')}`);
      } catch (err) {
        console.log(`[SMTP ATTACHMENT DEBUG] Error listing storage directory: ${err.message}`);
      }
      
      for (const path of pathsToTry) {
        try {
          console.log(`[SMTP APPROVAL] Attempting to read file from: ${path}`);
          mainPdfContent = await Deno.readFile(path);
          fileExists = true;
          fileSize = mainPdfContent.length;
          console.log(`[SMTP APPROVAL] Successfully read file: ${path} (${fileSize} bytes)`);
            break;
        } catch (error) {
          console.log(`[SMTP APPROVAL] Failed to read from ${path}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
    
    // Try reading child documents
    if (childDocumentPaths && childDocumentPaths.length > 0) {
      console.log(`[SMTP APPROVAL] Attempting to read ${childDocumentPaths.length} child documents`);
      
      for (const childPath of childDocumentPaths) {
        // Try multiple paths for each child document
        const childPathsToTry = [
          childPath,
          `./Public/documents/${childPath}`,
          `./documents/${childPath}`,
          `./uploads/${childPath}`,
          `./Public/uploads/${childPath}`,
          `./storage/${childPath}`,
          `./Public/storage/${childPath}`,
        ];
        
        for (const path of childPathsToTry) {
          try {
            console.log(`[SMTP APPROVAL] Attempting to read child file from: ${path}`);
            const childContent = await Deno.readFile(path);
            childPdfContents.push({path: childPath, content: childContent});
            fileExists = true;
            fileSize += childContent.length;
            console.log(`[SMTP APPROVAL] Successfully read child file: ${path} (${childContent.length} bytes)`);
            successfulAttachments++;
            break; // Break out of the paths loop for this child document
          } catch (error) {
            console.log(`[SMTP APPROVAL] Failed to read child from ${path}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }
      
      console.log(`[SMTP APPROVAL] Successfully read ${successfulAttachments} of ${childDocumentPaths.length} child documents`);
    }
    
    // If we couldn't read from the file system directly, fallback to loading from database
    if (!fileExists && documentFilePath) {
      try {
        console.log("[SMTP APPROVAL] Falling back to database lookup for file content");
        const { client } = await import("../db/denopost_conn.ts");
        const query = `
          SELECT file_path, document_content 
          FROM documents 
          WHERE file_path = $1 OR id = $2
        `;
        
        // Try to parse documentFilePath as an ID if it's numeric
        const possibleId = parseInt(documentFilePath.replace(/[^0-9]/g, ''));
        const queryParams = [documentFilePath, isNaN(possibleId) ? null : possibleId];
        
        console.log(`[SMTP APPROVAL] Querying database with params:`, queryParams);
        const result = await client.queryObject(query, queryParams);
        
        if (result.rows.length > 0) {
          const row = result.rows[0] as Record<string, any>;
          if (row.document_content) {
            console.log("[SMTP APPROVAL] Found document content in database");
            // If document_content is stored as base64, decode it
            if (typeof row.document_content === 'string') {
              try {
                mainPdfContent = decodeBase64(row.document_content);
              } catch (e) {
                console.error("[SMTP APPROVAL] Error decoding base64 content:", e);
              }
            } else if (row.document_content instanceof Uint8Array) {
              mainPdfContent = row.document_content;
            }
            
            if (mainPdfContent) {
              fileExists = true;
              fileSize = mainPdfContent.length;
              console.log(`[SMTP APPROVAL] Successfully retrieved ${fileSize} bytes from database`);
            }
          }
        }
      } catch (error) {
        console.error("[SMTP APPROVAL] Error retrieving document from database:", error);
      }
    }

    // Prepare email content
    const isCollection = childDocumentPaths && childDocumentPaths.length > 0;
    const attachmentCountText = isCollection 
      ? `the compiled document and ${successfulAttachments} child document${successfulAttachments !== 1 ? 's' : ''}`
      : 'the document';

    const subject = `Your request for "${documentTitle}" has been approved`;
    
    // Plain text version
    const text = `
Dear ${fullName},

We are pleased to inform you that your request to access "${documentTitle}" has been approved.

${fileExists 
  ? `We have attached ${attachmentCountText} to this email.` 
  : `Unfortunately, we could not locate the document file. Please contact our administrator for assistance.`
}

Thank you for using our document management system.

Regards,
sPeAS - Library Document Management System
`;

    // Get the approved email template
    let emailTemplate: string;
    try {
      console.log("[SMTP APPROVAL] Reading approval email template");
      emailTemplate = await Deno.readTextFile("./Public/pages/approvedEmailTemplate.html");
      console.log("[SMTP APPROVAL] Successfully read template file");
    } catch (error) {
      console.error("[SMTP APPROVAL] Error reading email template:", error);
      // Use a fallback template if the file can't be read
      emailTemplate = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #047857; border-bottom: 2px solid #d1fae5; padding-bottom: 10px;">Document Access Approved</h2>
  
  <p>Hello ${fullName},</p>
  
  <p>Your request for access to <strong>"${documentTitle}"</strong> has been approved.</p>
  
  ${fileExists 
    ? `<p><strong>✓</strong> We have attached ${attachmentCountText} to this email.</p>` 
    : `<p><strong style="color:#dc2626;">⚠</strong> The document could not be found in our system. Please contact the administrator for assistance.</p>`
  }
  
  <p style="margin-top: 30px;">Thank you for using our document management system.</p>
  
  <p style="margin-top: 30px; color: #6b7280; font-size: 0.9em;">Regards,<br>
  <strong>sPeAS</strong> - Library Document Management System</p>
</div>
`;
    }
    
    // Helper function to safely truncate long text
    const safeText = (text: string | undefined, maxLength = 1000): string => {
      if (!text) return "Not provided";
      if (text.length > maxLength) {
        return text.substring(0, maxLength) + "... (truncated for email)";
      }
      return text;
    };
    
    // Replace placeholders with actual content
    const replacements: Record<string, string> = {
      "[User's Full Name Placeholder]": safeText(fullName, 100),
      "[Item Title Placeholder]": safeText(documentTitle, 200),
      "[Request Number Placeholder]": safeText(requestId || `REQ-${Date.now()}`, 50),
      "[Author(s) Placeholder]": documentAuthor ? safeText(documentAuthor, 300) : "Not provided",
      "[Category Placeholder]": documentCategory ? safeText(documentCategory, 100) : "Not provided",
      "[KeywordsPlaceholder]": documentKeywords ? safeText(documentKeywords, 300) : "Not provided"
    };
    
    // Apply all replacements to the template
    let html = emailTemplate;
    for (const [placeholder, value] of Object.entries(replacements)) {
      try {
        html = html.split(placeholder).join(value);
      } catch (error) {
        console.error(`[SMTP APPROVAL] Error replacing placeholder ${placeholder}:`, error);
        html = html.replace(placeholder, "Content unavailable");
      }
    }

    // Directly create the message with the PDF content if we have it
    const message: any = {
      from: getFormattedFromAddress(),
      to: email,
      subject: subject,
      text: text,
      html: html,
      attachments: []
    };

    // Only try to add attachments if we have found files
    if (mainPdfContent && mainPdfContent.length > 0) {
      console.log(`[SMTP ATTACHMENT] Adding main document attachment (${fileSize} bytes)`);
      try {
        // Create a filename for the attachment - use the document title or ID
        const safeTitle = documentTitle.replace(/[^a-zA-Z0-9-_]/g, '_').substring(0, 50);
        const attachmentFilename = `${safeTitle}_${Date.now()}.pdf`;
        
        // Add the main document as an attachment
        message.attachments.push({
          filename: attachmentFilename,
          content: mainPdfContent,
          encoding: 'binary',
          contentType: 'application/pdf'
        });
        
        console.log(`[SMTP ATTACHMENT] Successfully added main document as "${attachmentFilename}"`);
      } catch (error) {
        console.error(`[SMTP ATTACHMENT] Error adding main document attachment:`, error);
      }
    } else {
      console.warn(`[SMTP ATTACHMENT] No content found for main document attachment!`);
    }
    
    // Add child documents if any were found
    if (childPdfContents && childPdfContents.length > 0) {
      console.log(`[SMTP ATTACHMENT] Adding ${childPdfContents.length} child document attachments`);
      
      childPdfContents.forEach((childDoc, index) => {
        try {
          // Create a filename based on the path or index
          const baseName = childDoc.path ? 
            childDoc.path.split('/').pop()?.split('\\').pop()?.replace(/\.[^/.]+$/, '') || `child-${index+1}` :
            `child-${index+1}`;
          
          const attachmentFilename = `${baseName}_${Date.now()}.pdf`;
          
          // Add this child document as an attachment
          message.attachments.push({
            filename: attachmentFilename,
            content: childDoc.content,
            encoding: 'binary',
            contentType: 'application/pdf'
          });
          
          console.log(`[SMTP ATTACHMENT] Successfully added child document #${index+1} as "${attachmentFilename}"`);
        } catch (error) {
          console.error(`[SMTP ATTACHMENT] Error adding child document #${index+1}:`, error);
        }
      });
    } 
    
    // Log the final message structure for debugging
    console.log(`[SMTP ATTACHMENT] Final email message has ${message.attachments.length} attachments`);
    if (message.attachments.length === 0) {
      console.warn(`[SMTP ATTACHMENT] WARNING: No attachments were added to the email!`);
      console.warn(`[SMTP ATTACHMENT] Document path tried: ${documentFilePath}`);
      console.warn(`[SMTP ATTACHMENT] Child documents expected: ${childDocumentPaths?.length || 0}`);
      }
      
    // Send the email with better error handling
    try {
    console.log(`[SMTP] Sending email to ${email} with subject "${subject}"`);
    
    // Initialize the SMTP client before attempting to send
    const client = initializeClient();
    if (!client) {
      console.error("[SMTP] Failed to initialize SMTP client");
      throw new Error("Failed to initialize SMTP client. Check your email settings.");
    }
    
    await client.send(message);
    console.log(`[SMTP] ✅ Email successfully sent to ${email} with subject "${subject}"`);
      
    // Log clear confirmation about attachment status
    if (fileExists) {
      console.log(`[FILE SENT SUCCESSFULLY] ✅✅✅ THE FILE WAS SUCCESSFULLY SENT TO ${email}`);
    } else {
      console.log(`[FILE NOT SENT] ⚠️⚠️⚠️ EMAIL WAS SENT BUT FILE WAS NOT ATTACHED TO ${email}`);
    }
    
      // Return detailed status
      return {
        success: true,
        documentPath: documentFilePath,
        fileExists: fileExists,
        fileSize: fileSize,
        attachment_success: fileExists,
        error: null
      };
    } catch (sendError) {
      // Handle specific error types
      const errorMessage = sendError instanceof Error ? sendError.message : String(sendError);
      
      let friendlyError = "Unknown email error";
      
      // Check for common SMTP errors
      if (errorMessage.includes("535") || errorMessage.includes("Username and Password not accepted")) {
        friendlyError = "Authentication failed. Please check your email username and password.";
      } else if (errorMessage.includes("Connection refused") || errorMessage.includes("ECONNREFUSED")) {
        friendlyError = "Connection to email server refused. Check server settings and firewall.";
      } else if (errorMessage.includes("timeout")) {
        friendlyError = "Connection to email server timed out. Check network settings.";
      } else if (errorMessage.includes("certificate")) {
        friendlyError = "SSL/TLS certificate error. Check your security settings.";
      } else {
        friendlyError = `Email error: ${errorMessage}`;
      }
      
      console.error("[SMTP] Error sending email:", sendError);
      console.error("[SMTP] Friendly error message:", friendlyError);
      
    await logEmailActivity("EMAIL_SEND_ERROR", {
        recipient: email,
        subject: subject,
        error: errorMessage,
        friendly_error: friendlyError,
        error_stack: sendError instanceof Error ? sendError.stack : 'No stack trace'
      });
      
      return {
        success: false,
        error: friendlyError,
        documentPath: documentFilePath,
        fileExists: fileExists,
        fileSize: fileSize,
        attachment_success: fileExists
      };
    }
  } catch (error) {
    console.error("[SMTP] Unexpected error in email service:", error);
    await logEmailActivity("EMAIL_UNEXPECTED_ERROR", {
      recipient: email,
      subject: subject,
      error: error instanceof Error ? error.message : String(error),
      error_stack: error instanceof Error ? error.stack : 'No stack trace'
    });
    
    return {
      success: false,
      error: "Unexpected error in email service. See logs for details.",
      documentPath: documentFilePath,
      fileExists: fileExists,
      fileSize: fileSize,
      attachment_success: fileExists
    };
  }
}

/**
 * Sends an email notification when a document request is rejected
 * @param email Recipient email
 * @param fullName Recipient's name
 * @param documentTitle Title of the document
 * @param reason Reason for rejection
 * @returns Promise resolving to boolean indicating success
 */
export async function sendRejectedRequestEmail(
  email: string,
  fullName: string,
  documentTitle: string,
  reason: string,
  requestId?: string
): Promise<boolean | { success: boolean; message: string; error?: string }> {
  console.log(`[EMAIL SERVICE] Preparing rejection email for ${email}`);
  
  // Log the beginning of this activity
  await logEmailActivity("DOCUMENT_REQUEST_REJECTION", {
    recipient: email,
    recipient_name: fullName,
    document: documentTitle,
    reason: reason,
    request_id: requestId || 'Not provided'
  });
  
  const subject = `Your request for "${documentTitle}" has been rejected`;
  
  // Get the rejection-specific email template
  let emailTemplate: string;
  try {
    // Log current working directory for debugging paths
    const cwd = Deno.cwd();
    console.log(`[EMAIL SERVICE] Current working directory: ${cwd}`);
    
    // Try multiple possible locations for the rejection template
    const possibleTemplatePaths = [
      "./Public/pages/rejectionEmailTemplate.html",
      "./Deno/Public/pages/rejectionEmailTemplate.html",
      "../Public/pages/rejectionEmailTemplate.html",
      "../../Public/pages/rejectionEmailTemplate.html",
      "./public/pages/rejectionEmailTemplate.html"
    ];
    
    let templateFound = false;
    
    for (const templatePath of possibleTemplatePaths) {
      try {
        console.log(`[EMAIL SERVICE] Trying to load template from: ${templatePath}`);
        emailTemplate = await Deno.readTextFile(templatePath);
        console.log(`[EMAIL SERVICE] ✅ Successfully loaded rejection email template from ${templatePath}`);
        templateFound = true;
        break;
      } catch (e) {
        console.log(`[EMAIL SERVICE] Template not found at ${templatePath}`);
      }
    }
    
    if (!templateFound) {
      // Fall back to the general template if rejection template is not found in any location
      console.log(`[EMAIL SERVICE] Rejection template not found in any location, trying general template`);
      try {
        emailTemplate = await Deno.readTextFile("./Public/pages/EmailTemplate.html");
        console.log(`[EMAIL SERVICE] Successfully loaded generic email template`);
      } catch (generalError) {
        throw new Error(`Could not find any email templates: ${generalError.message}`);
      }
    }
  } catch (error) {
    console.error("[EMAIL SERVICE] Error reading email templates:", error);
    // Use a fallback template if no template files can be read
    console.log("[EMAIL SERVICE] Using fallback rejection email template");
    emailTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #dc2626; color: white; padding: 10px 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; border: 1px solid #ddd; }
        .reason { background-color: #fee2e2; padding: 15px; border-left: 4px solid #dc2626; margin: 15px 0; }
        .footer { margin-top: 20px; font-size: 12px; color: #666; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>Document Request Rejected</h2>
        </div>
        <div class="content">
          <p>Dear [User's Full Name Placeholder],</p>
          <p>We regret to inform you that your request to access <strong>"[Item Title Placeholder]"</strong> has been rejected.</p>
          <div class="reason">
            <p><strong>Reason for rejection:</strong><br>[Rejection Reason Placeholder]</p>
          </div>
          <p>If you have any questions or believe this was in error, please contact our administration.</p>
          <p>Thank you for your understanding.</p>
          <p>Best regards,<br>Paulinian Electronic Archiving System</p>
        </div>
        <div class="footer">
          <p>This is an automated message. Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
    `;
  }
  
  // Helper function to safely truncate long text
  const safeText = (text: string | undefined, maxLength = 1000): string => {
    if (!text) return "Not provided";
    // Truncate if too long and add indicator
    if (text.length > maxLength) {
      return text.substring(0, maxLength) + "... (truncated for email)";
    }
    return text;
  };
  
  try {
    // Prepare the email content
    let html: string;
    
    if (emailTemplate.includes("[User's Full Name Placeholder]")) {
      // This is the template format, replace placeholders
      console.log(`[EMAIL SERVICE] Replacing placeholders in email template`);
      
      // Lookup request ID display value
      const displayRequestId = requestId || 'Not Available';
      
      // Replace placeholders with actual content
      const replacements: Record<string, string> = {
        "[User's Full Name Placeholder]": safeText(fullName, 100),
        "[Item Title Placeholder]": safeText(documentTitle, 200),
        "[Rejection Reason Placeholder]": safeText(reason, 500),
        "[Request Number Placeholder]": displayRequestId,
        // Additional placeholders that might be in the template
        "[Selected Reasons Placeholder]": safeText(reason, 500),
        "[Reason Details Placeholder]": "This request has been rejected by an administrator.",
      };
      
      // Apply all replacements to the template
      html = emailTemplate;
      for (const [placeholder, value] of Object.entries(replacements)) {
        html = html.split(placeholder).join(value);
      }
      
      console.log(`[EMAIL SERVICE] Placeholders replaced for rejection email`);
    } else {
      // Use the fallback template directly
      console.log(`[EMAIL SERVICE] Using custom rejection email template`);
      
      html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #dc2626; color: white; padding: 10px 20px; text-align: center; }
    .content { padding: 20px; background-color: #f9f9f9; border: 1px solid #ddd; }
    .reason { background-color: #fee2e2; padding: 15px; border-left: 4px solid #dc2626; margin: 15px 0; }
    .footer { margin-top: 20px; font-size: 12px; color: #666; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>Document Request Rejected</h2>
    </div>
    <div class="content">
      <p>Dear ${fullName},</p>
      <p>We regret to inform you that your request to access <strong>"${documentTitle}"</strong> has been rejected.</p>
      <div class="reason">
        <p><strong>Reason for rejection:</strong><br>${reason}</p>
      </div>
      <p>If you have any questions or believe this was in error, please contact our administration.</p>
      <p>Thank you for your understanding.</p>
      <p>Best regards,<br>Paulinian Electronic Archiving System</p>
    </div>
    <div class="footer">
      <p>This is an automated message. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
`;
    }
    
    // Create plain text version for clients that don't support HTML
    const text = `
Dear ${fullName},

We regret to inform you that your request to access "${documentTitle}" has been rejected.

Reason for rejection: ${reason}

If you have any questions or believe this was in error, please contact our administration.

Thank you for your understanding.

Best regards,
Paulinian Electronic Archiving System
`;

    console.log(`[EMAIL SERVICE] Sending rejection email to ${email}`);
    
    try {
      // Send the email
      const result = await sendEmailWithAttachment(
    email,
    subject,
    text,
    html
  );
      
      // Log the result
      if (result === true || (typeof result === 'object' && result.success)) {
        console.log(`[EMAIL SERVICE] ✅ Rejection email successfully sent to ${email}`);
        await logEmailActivity("DOCUMENT_REQUEST_REJECTION_SUCCESS", {
          recipient: email,
          subject: subject
        });
        return typeof result === 'object' ? result : true;
      } else {
        console.error(`[EMAIL SERVICE] ❌ Failed to send rejection email to ${email}:`, result);
        await logEmailActivity("DOCUMENT_REQUEST_REJECTION_FAILED", {
          recipient: email,
          error: typeof result === 'object' ? result.message || 'Unknown error' : 'Unknown error'
        });
        return typeof result === 'object' ? result : false;
      }
    } catch (sendError) {
      console.error(`[EMAIL SERVICE] Error sending rejection email:`, sendError);
      await logEmailActivity("DOCUMENT_REQUEST_REJECTION_ERROR", {
        recipient: email,
        error: sendError instanceof Error ? sendError.message : String(sendError)
      });
      return { 
        success: false, 
        message: "Failed to send email",
        error: sendError instanceof Error ? sendError.message : String(sendError)
      };
    }
  } catch (error) {
    console.error(`[EMAIL SERVICE] Error preparing rejection email:`, error);
    await logEmailActivity("DOCUMENT_REQUEST_REJECTION_ERROR", {
      recipient: email,
      error: error instanceof Error ? error.message : String(error)
    });
    return {
      success: false,
      message: "Error preparing rejection email",
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Sends a confirmation email when a document request is submitted
 * @param email Recipient email
 * @param fullName Recipient's name
 * @param documentInfo Document information (title, author, category, etc.)
 * @param requestInfo Request information (reason, affiliation, etc.)
 * @param requestId Unique ID assigned to the request
 * @returns Promise resolving to boolean indicating success
 */
export async function sendRequestConfirmationEmail(
  email: string,
  fullName: string,
  documentInfo: {
    title: string;
    author?: string;
    category?: string;
    researchAgenda?: string;
    abstract?: string;
  },
  requestInfo: {
    affiliation: string;
    reason: string;
    reasonDetails: string;
  },
  requestId: string
): Promise<boolean> {
  console.log(`[SMTP] Preparing document request confirmation email for ${email}`);
  
  // Log the beginning of this activity
  await logEmailActivity("DOCUMENT_REQUEST_CONFIRMATION", {
    recipient: email,
    recipient_name: fullName,
    document: documentInfo.title,
    request_id: requestId
  });
  
  const subject = `Your request for "${documentInfo.title}" has been received`;
  
  // Get the email template
  let emailTemplate: string;
  try {
    emailTemplate = await Deno.readTextFile("./Public/pages/EmailTemplate.html");
  } catch (error) {
    console.error("[SMTP] Error reading email template:", error);
    // Use a fallback template if the file can't be read
    emailTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #008000; color: white; padding: 10px 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; border: 1px solid #ddd; }
        .highlight { background-color: #f0e68c; padding: 15px; border-left: 4px solid #daa520; margin: 15px 0; }
        .details { margin-top: 20px; border-top: 1px solid #ddd; padding-top: 20px; }
        .footer { margin-top: 20px; font-size: 12px; color: #666; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>Document Request Receipt</h2>
        </div>
        <div class="content">
          <p>Dear [User's Full Name Placeholder],</p>
          <div class="highlight">
            <p>Thank you for submitting your request for full access to the item "[Item Title Placeholder]". Your request has been received and successfully forwarded for approval.</p>
            <p>Upon approval, you will receive a separate email containing the PDF of the requested item.</p>
          </div>
          <div class="details">
            <h3>Your Request Number: [Request Number Placeholder]</h3>
            <h3>Requestor Details:</h3>
            <p>Full Name: [User's Full Name Placeholder]</p>
            <p>Email: [User's Email Placeholder]</p>
            <p>Affiliation: [User's Affiliation Placeholder]</p>
            <p>Reason(s) for Access: [Selected Reasons Placeholder]</p>
            <p>Reason Details: [Reason Details Placeholder]</p>
          </div>
          <div class="details">
            <h3>Details:</h3>
            <p>Title: [Item Title Placeholder]</p>
            <p>Author(s): [Author(s) Placeholder]</p>
            <p>Category: [Category Placeholder]</p>
            <p>Research Agenda: [Research Agenda Placeholder]</p>
            <p>Abstract: [Item Abstract Placeholder]</p>
          </div>
          <p>If you have any questions regarding your request, please contact us and reference your Request Number.</p>
        </div>
        <div class="footer">
          <p>© Paulinian Electronic Archiving System. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
    `;
  }
  
  // Helper function to safely truncate long text
  const safeText = (text: string | undefined, maxLength = 1000): string => {
    if (!text) return "Not provided";
    // Truncate if too long and add indicator
    if (text.length > maxLength) {
      return text.substring(0, maxLength) + "... (truncated for email)";
    }
    return text;
  };
  
  // Replace placeholders with actual content - with length limits to prevent RangeError
  const replacements: Record<string, string> = {
    "[User's Full Name Placeholder]": safeText(fullName, 100),
    "[User's Email Placeholder]": safeText(email, 100),
    "[User's Affiliation Placeholder]": safeText(requestInfo.affiliation, 200),
    "[Selected Reasons Placeholder]": safeText(requestInfo.reason, 500),
    "[Reason Details Placeholder]": safeText(requestInfo.reasonDetails, 1000),
    "[Item Title Placeholder]": safeText(documentInfo.title, 200),
    "[Author(s) Placeholder]": safeText(documentInfo.author, 300),
    "[Category Placeholder]": safeText(documentInfo.category, 100),
    "[Research Agenda Placeholder]": safeText(documentInfo.researchAgenda, 300),
    "[Item Abstract Placeholder]": safeText(documentInfo.abstract, 2000),
    "[Request Number Placeholder]": safeText(requestId, 50)
  };
  
  // Apply all replacements to the template - safer approach to avoid regex issues
  let emailHtml = emailTemplate;
  for (const [placeholder, value] of Object.entries(replacements)) {
    try {
      // Use split and join instead of regex for safer replacement
      emailHtml = emailHtml.split(placeholder).join(value);
    } catch (error) {
      console.error(`[SMTP] Error replacing placeholder ${placeholder}:`, error);
      // If replacement fails, try a direct approach with a simpler placeholder
      emailHtml = emailHtml.replace(placeholder, "Content unavailable");
    }
  }
  
  // Simple plain text version of the email
  const text = `
Document Request Receipt

Dear ${fullName},

Thank you for submitting your request for full access to the item "${documentInfo.title}". Your request has been received and successfully forwarded for approval.

Your Request Number: ${requestId}

Request Details:
- Full Name: ${fullName}
- Email: ${email}
- Affiliation: ${requestInfo.affiliation}
- Reason(s) for Access: ${requestInfo.reason}
- Reason Details: ${requestInfo.reasonDetails}

Document Details:
- Title: ${documentInfo.title}
- Author(s): ${documentInfo.author || "Not provided"}
- Category: ${documentInfo.category || "Not provided"}
- Research Agenda: ${documentInfo.researchAgenda || "Not provided"}

Upon approval, you will receive a separate email containing the PDF of the requested item.

If you have any questions regarding your request, please contact us and reference your Request Number.

Best regards,
Paulinian Electronic Archiving System
`;

  try {
    const result = await sendEmailWithAttachment(
      email,
      subject,
      text,
      emailHtml
    );
    
    // Log the result with clear status information
    if (result && result.success === true) {
      console.log(`[SMTP] ✅ Document request confirmation email successfully sent to ${email}`);
      
      // Log success
      await logEmailActivity("REQUEST_CONFIRMATION_SENT_SUCCESS", {
        recipient: email,
        recipient_name: fullName,
        document: documentInfo.title,
        request_id: requestId
      });
      return true;
    } else {
      const errorMessage = result && result.error ? result.error : "Unknown error";
      console.error(`[SMTP] ❌ Failed to send document request confirmation email to ${email}: ${errorMessage}`);
      
      // Log failure
      await logEmailActivity("REQUEST_CONFIRMATION_SENT_FAILURE", {
        recipient: email,
        document: documentInfo.title,
        request_id: requestId,
        error: errorMessage
      });
      return false;
    }
  } catch (error) {
    console.error(`[SMTP] Error in sendRequestConfirmationEmail:`, error);
    
    // Log error
    await logEmailActivity("REQUEST_CONFIRMATION_SENT_ERROR", {
      recipient: email,
      document: documentInfo.title,
      request_id: requestId,
      error: error instanceof Error ? error.message : String(error)
    });
    
    return false;
  }
} 