import { join } from "../deps.ts";

/**
 * FileCheckService - Utility to help troubleshoot file location and access issues
 */
export class FileCheckService {
  /**
   * Check if a file exists at a given path
   * @param path Path to check
   * @returns Object with existence status and file information if found
   */
  static async fileExists(path: string): Promise<{
    exists: boolean;
    size?: number;
    error?: string;
    path: string;
  }> {
    try {
      console.log(`[FILE CHECK] Checking file existence: ${path}`);
      const fileInfo = await Deno.stat(path);
      return {
        exists: true,
        size: fileInfo.size,
        path
      };
    } catch (error) {
      return {
        exists: false,
        error: error instanceof Error ? error.message : String(error),
        path
      };
    }
  }

  /**
   * Search for a file in common storage locations
   * @param fileName Name of the file to search for
   * @returns Array of paths where the file was found
   */
  static async findInStorage(fileName: string): Promise<Array<{
    path: string;
    exists: boolean;
    size?: number;
  }>> {
    console.log(`[FILE CHECK] Searching for file: ${fileName}`);
    
    // Get workspace root (parent of Deno directory)
    const workspaceRoot = Deno.cwd().replace(/[\\/]Deno$/, '');
    console.log(`[FILE CHECK] Workspace root: ${workspaceRoot}`);
    
    // Common storage directories to check
    const storageDirs = [
      'storage/thesis',
      'storage/dissertation', 
      'storage/confluence',
      'storage/synergy',
      'storage'
    ];
    
    const results = [];
    
    // Check each directory
    for (const dir of storageDirs) {
      const path = join(workspaceRoot, dir, fileName);
      const result = await this.fileExists(path);
      results.push(result);
      
      // Also try with .file extension if not already using it
      if (!fileName.endsWith('.file')) {
        const fileExtPath = join(workspaceRoot, dir, `${fileName}.file`);
        const fileExtResult = await this.fileExists(fileExtPath);
        results.push(fileExtResult);
      }
    }
    
    // Find files with similar names in thesis directory
    try {
      console.log(`[FILE CHECK] Searching for similar files in thesis directory`);
      const fileNamePart = fileName.split('.')[0].split('_')[0];
      
      if (fileNamePart && fileNamePart.length > 3) {
        for await (const entry of Deno.readDir(join(workspaceRoot, 'storage/thesis'))) {
          if (entry.isFile && entry.name.includes(fileNamePart)) {
            const path = join(workspaceRoot, 'storage/thesis', entry.name);
            const fileInfo = await Deno.stat(path);
            results.push({
              exists: true,
              path,
              size: fileInfo.size
            });
          }
        }
      }
    } catch (error) {
      console.error(`[FILE CHECK] Error searching for similar files:`, error);
    }
    
    // List all available files in thesis directory for debugging
    try {
      console.log(`[FILE CHECK] Available files in thesis directory:`);
      for await (const entry of Deno.readDir(join(workspaceRoot, 'storage/thesis'))) {
        if (entry.isFile) {
          console.log(`  - ${entry.name}`);
        }
      }
    } catch (error) {
      console.error(`[FILE CHECK] Error listing files:`, error);
    }
    
    return results;
  }
}

// Export a test function that can be called directly for debugging
export async function testFileLocations(fileNames: string[]): Promise<void> {
  console.log(`[FILE CHECK] Testing ${fileNames.length} file locations`);
  
  for (const fileName of fileNames) {
    console.log(`\n[FILE CHECK] Checking file: ${fileName}`);
    const results = await FileCheckService.findInStorage(fileName);
    
    const found = results.filter(r => r.exists);
    if (found.length > 0) {
      console.log(`[FILE CHECK] ✅ File found in ${found.length} locations:`);
      found.forEach((result, i) => {
        console.log(`  ${i+1}. ${result.path} (${result.size} bytes)`);
      });
    } else {
      console.log(`[FILE CHECK] ❌ File not found in any location`);
    }
  }
} 