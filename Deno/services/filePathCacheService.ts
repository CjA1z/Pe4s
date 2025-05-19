/**
 * File Path Cache Service
 * Provides caching for file paths to avoid repetitive disk searches
 */

import { FileCheckService } from './fileCheckService.ts';
import { ensureDir } from "https://deno.land/std@0.190.0/fs/ensure_dir.ts";
import { join } from "../deps.ts";

// Cache of file paths
interface FilePathInfo {
  path: string;          // Full path to the file
  exists: boolean;       // Whether the file exists
  size: number;          // File size in bytes
  lastChecked: number;   // Timestamp of last check
  lastModified?: number; // Timestamp of last modification if available
}

// File path cache - key is document ID or filename
const pathCache = new Map<string, FilePathInfo>();

// Cache constants
const CACHE_EXPIRY = 10 * 60 * 1000; // 10 minutes
const MAX_CACHE_SIZE = 1000;         // Maximum number of cache entries
const COMMON_BASE_PATHS = [
  './Public/documents/',
  './documents/',
  './uploads/',
  './Public/uploads/',
  './storage/',
  './Public/storage/',
  './storage/thesis/',
  './storage/dissertation/',
  './storage/confluence/',
  './storage/synergy/',
  './Public/documents/thesis/',
  './Public/documents/dissertation/'
];

// Cache persistence 
const CACHE_DIR = "./logs/cache";
const CACHE_FILE = "file_path_cache.json";
let cacheInitialized = false;

/**
 * Initializes the cache service
 */
export async function initialize() {
  if (cacheInitialized) return;
  
  try {
    await ensureDir(CACHE_DIR);
    await loadCacheFromDisk();
    cacheInitialized = true;
    console.log(`[FILE CACHE] Initialized with ${pathCache.size} entries`);
    
    // Schedule periodic cache saving
    setInterval(saveCacheToDisk, 5 * 60 * 1000); // Save every 5 minutes
  } catch (error) {
    console.error(`[FILE CACHE] Initialization error:`, error);
  }
}

/**
 * Loads the cache from disk
 */
async function loadCacheFromDisk() {
  try {
    const cacheFilePath = join(CACHE_DIR, CACHE_FILE);
    const fileInfo = await Deno.stat(cacheFilePath).catch(() => null);
    
    if (!fileInfo) {
      console.log(`[FILE CACHE] No cache file found at ${cacheFilePath}`);
      return;
    }
    
    console.log(`[FILE CACHE] Loading cache from ${cacheFilePath}`);
    const cacheJson = await Deno.readTextFile(cacheFilePath);
    const cacheData = JSON.parse(cacheJson);
    
    if (Array.isArray(cacheData)) {
      for (const [key, value] of cacheData) {
        pathCache.set(key, value);
      }
      console.log(`[FILE CACHE] Loaded ${pathCache.size} entries from disk`);
    }
  } catch (error) {
    console.error(`[FILE CACHE] Error loading cache from disk:`, error);
    // Don't fail initialization if loading fails
  }
}

/**
 * Saves the cache to disk
 */
async function saveCacheToDisk() {
  try {
    // Only save if we have items in the cache
    if (pathCache.size === 0) {
      return;
    }
    
    await ensureDir(CACHE_DIR);
    const cacheFilePath = join(CACHE_DIR, CACHE_FILE);
    
    // Convert Map to array for JSON serialization
    const cacheArray = Array.from(pathCache.entries());
    await Deno.writeTextFile(cacheFilePath, JSON.stringify(cacheArray));
    
    console.log(`[FILE CACHE] Saved ${pathCache.size} entries to disk`);
  } catch (error) {
    console.error(`[FILE CACHE] Error saving cache to disk:`, error);
  }
}

/**
 * Cleans up expired or excessive cache entries
 */
function cleanupCache() {
  if (pathCache.size <= MAX_CACHE_SIZE) {
    return;
  }
  
  console.log(`[FILE CACHE] Cache cleanup: ${pathCache.size} entries exceed limit of ${MAX_CACHE_SIZE}`);
  
  // Get all entries and sort by last access time (oldest first)
  const entries = Array.from(pathCache.entries())
    .sort(([, a], [, b]) => a.lastChecked - b.lastChecked);
  
  // Remove oldest entries until we're back under the limit
  const removeCount = pathCache.size - MAX_CACHE_SIZE;
  for (let i = 0; i < removeCount; i++) {
    if (entries[i]) {
      pathCache.delete(entries[i][0]);
    }
  }
  
  console.log(`[FILE CACHE] Removed ${removeCount} oldest cache entries`);
}

/**
 * Checks if a cache entry is expired
 * @param info The file path info to check
 * @returns Whether the cache entry is expired
 */
function isCacheExpired(info: FilePathInfo): boolean {
  return Date.now() - info.lastChecked > CACHE_EXPIRY;
}

/**
 * Gets the paths to check for a given document ID or filename
 * @param idOrFilename Document ID or filename
 * @returns Array of paths to check
 */
function getPathsToCheck(idOrFilename: string): string[] {
  // Start with common base paths
  const paths = [...COMMON_BASE_PATHS.map(base => `${base}${idOrFilename}`)];
  
  // Add the ID or filename itself as a path (might be absolute)
  paths.push(idOrFilename);
  
  // Add paths with current working directory
  paths.push(
    `${Deno.cwd()}/Public/documents/${idOrFilename}`,
    `${Deno.cwd()}/documents/${idOrFilename}`,
    `${Deno.cwd()}/uploads/${idOrFilename}`,
    `${Deno.cwd()}/storage/${idOrFilename}`
  );
  
  // If it doesn't have a PDF extension, try adding it
  if (!idOrFilename.toLowerCase().endsWith('.pdf')) {
    // Add PDF extension to all paths
    const withExt = `${idOrFilename}.pdf`;
    paths.push(...COMMON_BASE_PATHS.map(base => `${base}${withExt}`));
    paths.push(withExt);
    paths.push(
      `${Deno.cwd()}/Public/documents/${withExt}`,
      `${Deno.cwd()}/documents/${withExt}`,
      `${Deno.cwd()}/uploads/${withExt}`,
      `${Deno.cwd()}/storage/${withExt}`
    );
  }
  
  return paths;
}

/**
 * Finds a file in the storage system using the cache first
 * @param idOrFilename Document ID or filename
 * @returns File path info if found
 */
export async function findFile(idOrFilename: string): Promise<FilePathInfo | null> {
  if (!idOrFilename) {
    return null;
  }
  
  // Initialize cache service if not already done
  if (!cacheInitialized) {
    await initialize();
  }
  
  // Check cache first
  const cacheKey = idOrFilename.toString();
  const cachedInfo = pathCache.get(cacheKey);
  
  // If we have a cache hit and it's not expired, return it
  if (cachedInfo && !isCacheExpired(cachedInfo) && cachedInfo.exists) {
    // Verify the file still exists (quick check for cache consistency)
    try {
      const fileInfo = await Deno.stat(cachedInfo.path);
      // Update last checked time
      cachedInfo.lastChecked = Date.now();
      if (fileInfo.mtime) {
        cachedInfo.lastModified = fileInfo.mtime.getTime();
      }
      // If size changed, update it
      if (fileInfo.size !== cachedInfo.size) {
        cachedInfo.size = fileInfo.size;
      }
      return cachedInfo;
    } catch (error) {
      // File no longer exists, remove from cache
      console.log(`[FILE CACHE] Cached file no longer exists: ${cachedInfo.path}`);
      pathCache.delete(cacheKey);
    }
  }
  
  // Cache miss or expired, check the file system
  console.log(`[FILE CACHE] Cache miss for ${idOrFilename}, checking file system`);
  
  const pathsToCheck = getPathsToCheck(idOrFilename);
  
  // Check paths one by one
  for (const path of pathsToCheck) {
    try {
      const fileInfo = await Deno.stat(path);
      
      if (fileInfo.isFile) {
        // Found the file, cache it
        const newInfo: FilePathInfo = {
          path,
          exists: true,
          size: fileInfo.size,
          lastChecked: Date.now(),
          lastModified: fileInfo.mtime ? fileInfo.mtime.getTime() : undefined
        };
        
        // Update cache
        pathCache.set(cacheKey, newInfo);
        
        // Clean up cache if necessary
        if (pathCache.size > MAX_CACHE_SIZE) {
          cleanupCache();
        }
        
        return newInfo;
      }
    } catch (error) {
      // File not found at this path, continue to next
    }
  }
  
  // If file not found using direct paths, try using FileCheckService
  try {
    const results = await FileCheckService.findInStorage(idOrFilename);
    const found = results.find(r => r.exists);
    
    if (found) {
      const newInfo: FilePathInfo = {
        path: found.path,
        exists: true,
        size: found.size || 0,
        lastChecked: Date.now()
      };
      
      // Update cache
      pathCache.set(cacheKey, newInfo);
      
      return newInfo;
    }
  } catch (error) {
    console.error(`[FILE CACHE] Error using FileCheckService:`, error);
  }
  
  // File not found, cache negative result
  const negativeInfo: FilePathInfo = {
    path: idOrFilename,
    exists: false,
    size: 0,
    lastChecked: Date.now()
  };
  
  // Cache negative result with shorter expiry
  pathCache.set(cacheKey, negativeInfo);
  
  return null;
}

/**
 * Finds multiple files at once using the cache
 * @param idsOrFilenames Array of document IDs or filenames
 * @returns Array of file path infos for found files
 */
export async function findFiles(idsOrFilenames: string[]): Promise<FilePathInfo[]> {
  const results: FilePathInfo[] = [];
  
  for (const idOrFilename of idsOrFilenames) {
    const result = await findFile(idOrFilename);
    if (result && result.exists) {
      results.push(result);
    }
  }
  
  return results;
}

/**
 * Invalidates a cache entry
 * @param idOrFilename Document ID or filename
 */
export function invalidateCache(idOrFilename: string) {
  pathCache.delete(idOrFilename.toString());
}

/**
 * Clears the entire cache
 */
export function clearCache() {
  pathCache.clear();
  console.log(`[FILE CACHE] Cache cleared`);
} 