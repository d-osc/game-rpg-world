/**
 * Authentication Service
 * Handles user registration, login, and JWT token management
 */

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query, transaction } from '../database/index.ts';
import type { PoolClient } from 'pg';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || '7d';
const SALT_ROUNDS = 10;

export interface RegisterData {
	username: string;
	email: string;
	password: string;
}

export interface LoginData {
	username: string;
	password: string;
}

export interface AuthResponse {
	success: boolean;
	message: string;
	data?: {
		playerId: string;
		username: string;
		email: string;
		token: string;
	};
	error?: string;
}

export interface TokenPayload {
	playerId: string;
	username: string;
	iat?: number;
	exp?: number;
}

export class AuthService {
	/**
	 * Register a new player
	 */
	static async register(data: RegisterData): Promise<AuthResponse> {
		try {
			// Validate input
			if (!data.username || data.username.length < 3) {
				return {
					success: false,
					message: 'Username must be at least 3 characters long',
					error: 'INVALID_USERNAME',
				};
			}

			if (!data.email || !this.isValidEmail(data.email)) {
				return {
					success: false,
					message: 'Invalid email address',
					error: 'INVALID_EMAIL',
				};
			}

			if (!data.password || data.password.length < 8) {
				return {
					success: false,
					message: 'Password must be at least 8 characters long',
					error: 'INVALID_PASSWORD',
				};
			}

			// Check if username or email already exists
			const existingUser = await query(
				'SELECT id FROM players WHERE username = $1 OR email = $2',
				[data.username, data.email],
			);

			if (existingUser.rows.length > 0) {
				return {
					success: false,
					message: 'Username or email already exists',
					error: 'USER_EXISTS',
				};
			}

			// Hash password
			const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);

			// Create player and profile in a transaction
			const result = await transaction(async (client: PoolClient) => {
				// Insert player
				const playerResult = await client.query(
					`INSERT INTO players (username, email, password_hash)
					 VALUES ($1, $2, $3)
					 RETURNING id, username, email, created_at`,
					[data.username, data.email, passwordHash],
				);

				const player = playerResult.rows[0];

				// Create player profile with default values
				await client.query(
					`INSERT INTO player_profiles (player_id, display_name)
					 VALUES ($1, $2)`,
					[player.id, data.username],
				);

				return player;
			});

			// Generate JWT token
			const token = this.generateToken({
				playerId: result.id,
				username: result.username,
			});

			// Create session
			await this.createSession(result.id, token);

			console.log('[Auth] User registered:', result.username);

			return {
				success: true,
				message: 'Registration successful',
				data: {
					playerId: result.id,
					username: result.username,
					email: result.email,
					token,
				},
			};
		} catch (error) {
			console.error('[Auth] Registration error:', error);
			return {
				success: false,
				message: 'Registration failed',
				error: 'REGISTRATION_ERROR',
			};
		}
	}

	/**
	 * Login existing player
	 */
	static async login(data: LoginData): Promise<AuthResponse> {
		try {
			// Get player by username
			const result = await query(
				`SELECT id, username, email, password_hash, is_active, is_banned
				 FROM players
				 WHERE username = $1`,
				[data.username],
			);

			if (result.rows.length === 0) {
				return {
					success: false,
					message: 'Invalid username or password',
					error: 'INVALID_CREDENTIALS',
				};
			}

			const player = result.rows[0];

			// Check if account is banned
			if (player.is_banned) {
				return {
					success: false,
					message: 'Account has been banned',
					error: 'ACCOUNT_BANNED',
				};
			}

			// Check if account is active
			if (!player.is_active) {
				return {
					success: false,
					message: 'Account is not active',
					error: 'ACCOUNT_INACTIVE',
				};
			}

			// Verify password
			const passwordValid = await bcrypt.compare(
				data.password,
				player.password_hash,
			);

			if (!passwordValid) {
				return {
					success: false,
					message: 'Invalid username or password',
					error: 'INVALID_CREDENTIALS',
				};
			}

			// Update last login
			await query('UPDATE players SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [
				player.id,
			]);

			// Generate JWT token
			const token = this.generateToken({
				playerId: player.id,
				username: player.username,
			});

			// Create session
			await this.createSession(player.id, token);

			console.log('[Auth] User logged in:', player.username);

			return {
				success: true,
				message: 'Login successful',
				data: {
					playerId: player.id,
					username: player.username,
					email: player.email,
					token,
				},
			};
		} catch (error) {
			console.error('[Auth] Login error:', error);
			return {
				success: false,
				message: 'Login failed',
				error: 'LOGIN_ERROR',
			};
		}
	}

	/**
	 * Verify JWT token
	 */
	static async verifyToken(token: string): Promise<TokenPayload | null> {
		try {
			const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;

			// Check if session is still valid
			const sessionResult = await query(
				`SELECT id FROM sessions
				 WHERE token_hash = $1 AND is_active = true AND expires_at > CURRENT_TIMESTAMP`,
				[this.hashToken(token)],
			);

			if (sessionResult.rows.length === 0) {
				return null;
			}

			return decoded;
		} catch (error) {
			console.error('[Auth] Token verification error:', error);
			return null;
		}
	}

	/**
	 * Logout player (invalidate session)
	 */
	static async logout(token: string): Promise<boolean> {
		try {
			await query(
				'UPDATE sessions SET is_active = false WHERE token_hash = $1',
				[this.hashToken(token)],
			);
			return true;
		} catch (error) {
			console.error('[Auth] Logout error:', error);
			return false;
		}
	}

	/**
	 * Generate JWT token
	 */
	private static generateToken(payload: TokenPayload): string {
		return jwt.sign(payload, JWT_SECRET, {
			expiresIn: JWT_EXPIRATION,
		});
	}

	/**
	 * Create session record
	 */
	private static async createSession(playerId: string, token: string): Promise<void> {
		const tokenHash = this.hashToken(token);
		const decoded = jwt.decode(token) as any;
		const expiresAt = new Date(decoded.exp * 1000);

		await query(
			`INSERT INTO sessions (player_id, token_hash, expires_at)
			 VALUES ($1, $2, $3)`,
			[playerId, tokenHash, expiresAt],
		);
	}

	/**
	 * Hash token for storage
	 */
	private static hashToken(token: string): string {
		return require('crypto').createHash('sha256').update(token).digest('hex');
	}

	/**
	 * Validate email format
	 */
	private static isValidEmail(email: string): boolean {
		const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
		return emailRegex.test(email);
	}
}
