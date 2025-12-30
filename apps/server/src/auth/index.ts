/**
 * Auth Module
 * Exports all authentication functionality
 */

export { AuthService } from './AuthService.ts';
export type { RegisterData, LoginData, AuthResponse, TokenPayload } from './AuthService.ts';
export { authMiddleware, optionalAuthMiddleware } from './middleware.ts';
