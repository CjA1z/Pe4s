import { updateUserPassword } from "../controllers/userPasswordController.ts";

/**
 * Handle user password update requests
 * 
 * @param request The HTTP request
 * @returns HTTP response
 */
export async function handleUserPasswordUpdate(request: Request): Promise<Response> {
  // Simply pass the request to the controller
  return await updateUserPassword(request);
} 