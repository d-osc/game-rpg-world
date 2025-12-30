/**
 * Authentication Middleware
 * Middleware for protecting routes with JWT authentication
 */

import { AuthService } from './AuthService.ts';
import type { Context } from 'elit';

/**
 * Extract token from Authorization header
 */
function extractToken(authHeader: string | undefined): string | null {
	if (!authHeader) {
		return null;
	}

	// Expected format: "Bearer <token>"
	const parts = authHeader.split(' ');
	if (parts.length !== 2 || parts[0] !== 'Bearer') {
		return null;
	}

	return parts[1];
}

/**
 * Authentication middleware
 * Verifies JWT token and attaches player data to context
 */
export async function authMiddleware(ctx: Context, next: () => Promise<void>) {
	const authHeader = ctx.request.headers.get('authorization');
	const token = extractToken(authHeader);

	if (!token) {
		ctx.status(401).json({
			error: 'Unauthorized',
			message: 'No token provided',
		});
		return;
	}

	const payload = await AuthService.verifyToken(token);

	if (!payload) {
		ctx.status(401).json({
			error: 'Unauthorized',
			message: 'Invalid or expired token',
		});
		return;
	}

	// Attach player data to context
	(ctx as any).player = payload;

	await next();
}

/**
 * Optional authentication middleware
 * Attaches player data if token is valid, but doesn't reject if missing
 */
export async function optionalAuthMiddleware(
	ctx: Context,
	next: () => Promise<void>,
) {
	const authHeader = ctx.request.headers.get('authorization');
	const token = extractToken(authHeader);

	if (token) {
		const payload = await AuthService.verifyToken(token);
		if (payload) {
			(ctx as any).player = payload;
		}
	}

	await next();
}
