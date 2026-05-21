/**
 * Authentication Service
 * Handles user registration, login, and JWT token management
 * Uses elit/database for data storage
 */

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { players, sessions, profiles } from '../database/index.ts';
import { randomUUID } from 'crypto';

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
	static async register(data: RegisterData): Promise<AuthResponse> {
		try {
			if (!data.username || data.username.length < 3) {
				return { success: false, message: 'Username must be at least 3 characters long', error: 'INVALID_USERNAME' };
			}

			if (!data.email || !this.isValidEmail(data.email)) {
				return { success: false, message: 'Invalid email address', error: 'INVALID_EMAIL' };
			}

			if (!data.password || data.password.length < 8) {
				return { success: false, message: 'Password must be at least 8 characters long', error: 'INVALID_PASSWORD' };
			}

			const existing = players.findOne((p: any) => p.username === data.username || p.email === data.email);
			if (existing) {
				return { success: false, message: 'Username or email already exists', error: 'USER_EXISTS' };
			}

			const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
			const playerId = randomUUID();

			players.insert({
				id: playerId,
				username: data.username,
				email: data.email,
				passwordHash,
				isActive: true,
				isBanned: false,
				createdAt: new Date().toISOString(),
				lastLogin: null,
			});

			profiles.insert({
				playerId,
				displayName: data.username,
				level: 1,
				experience: 0,
				gold: 0,
				positionX: 0,
				positionY: 0,
				currentMap: 'town',
				health: 100,
				maxHealth: 100,
				mana: 50,
				maxMana: 50,
				stats: { strength: 10, dexterity: 10, intelligence: 10, vitality: 10, luck: 10 },
			});

			const token = this.generateToken({ playerId, username: data.username });
			this.createSession(playerId, token);

			console.log('[Auth] User registered:', data.username);

			return {
				success: true,
				message: 'Registration successful',
				data: { playerId, username: data.username, email: data.email, token },
			};
		} catch (error) {
			console.error('[Auth] Registration error:', error);
			return { success: false, message: 'Registration failed', error: 'REGISTRATION_ERROR' };
		}
	}

	static async login(data: LoginData): Promise<AuthResponse> {
		try {
			const player = players.findOne((p: any) => p.username === data.username);

			if (!player) {
				return { success: false, message: 'Invalid username or password', error: 'INVALID_CREDENTIALS' };
			}

			if (player.isBanned) {
				return { success: false, message: 'Account has been banned', error: 'ACCOUNT_BANNED' };
			}

			if (!player.isActive) {
				return { success: false, message: 'Account is not active', error: 'ACCOUNT_INACTIVE' };
			}

			const passwordValid = await bcrypt.compare(data.password, player.passwordHash);
			if (!passwordValid) {
				return { success: false, message: 'Invalid username or password', error: 'INVALID_CREDENTIALS' };
			}

			players.update((p: any) => p.id === player.id, { lastLogin: new Date().toISOString() });

			const token = this.generateToken({ playerId: player.id, username: player.username });
			this.createSession(player.id, token);

			console.log('[Auth] User logged in:', player.username);

			return {
				success: true,
				message: 'Login successful',
				data: { playerId: player.id, username: player.username, email: player.email, token },
			};
		} catch (error) {
			console.error('[Auth] Login error:', error);
			return { success: false, message: 'Login failed', error: 'LOGIN_ERROR' };
		}
	}

	static async verifyToken(token: string): Promise<TokenPayload | null> {
		try {
			const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
			const tokenHash = this.hashToken(token);

			const session = sessions.findOne((s: any) => s.tokenHash === tokenHash && s.isActive && new Date(s.expiresAt) > new Date());
			if (!session) return null;

			return decoded;
		} catch {
			return null;
		}
	}

	static async logout(token: string): Promise<boolean> {
		try {
			const tokenHash = this.hashToken(token);
			sessions.update((s: any) => s.tokenHash === tokenHash, { isActive: false });
			return true;
		} catch {
			return false;
		}
	}

	private static generateToken(payload: TokenPayload): string {
		return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRATION as any });
	}

	private static createSession(playerId: string, token: string): void {
		const decoded = jwt.decode(token) as any;
		sessions.insert({
			id: randomUUID(),
			playerId,
			tokenHash: this.hashToken(token),
			expiresAt: new Date(decoded.exp * 1000).toISOString(),
			isActive: true,
		});
	}

	private static hashToken(token: string): string {
		const { createHash } = require('crypto');
		return createHash('sha256').update(token).digest('hex');
	}

	private static isValidEmail(email: string): boolean {
		return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email);
	}
}
