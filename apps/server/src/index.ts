/**
 * RPG Game Server
 * Elit-based backend server for authentication, save/load, and multiplayer coordination
 */

import { Elit } from 'elit';
import { testConnection } from './database/index.ts';
import { AuthService } from './auth/index.ts';
import { authMiddleware } from './auth/middleware.ts';
import { SaveService } from './save/index.ts';

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || 'localhost';

const app = new Elit();

console.log('[RPG Server] Initializing...');

// Initialize database connection
testConnection().catch((error) => {
	console.error('[RPG Server] Database connection failed:', error);
	console.log('[RPG Server] Running without database connection');
});

// Health check endpoint
app.get('/health', (ctx) => {
	ctx.json({
		status: 'ok',
		timestamp: new Date().toISOString(),
		service: 'rpg-game-server',
		version: '0.1.0',
	});
});

// API Router
app.get('/api/test', (ctx) => {
	ctx.json({
		message: 'API is working!',
		timestamp: new Date().toISOString(),
	});
});

// Auth routes
app.post('/api/auth/register', async (ctx) => {
	const body = await ctx.request.json();
	const result = await AuthService.register(body);

	if (result.success) {
		ctx.status(201).json(result);
	} else {
		ctx.status(400).json(result);
	}
});

app.post('/api/auth/login', async (ctx) => {
	const body = await ctx.request.json();
	const result = await AuthService.login(body);

	if (result.success) {
		ctx.json(result);
	} else {
		ctx.status(401).json(result);
	}
});

app.post('/api/auth/logout', authMiddleware, async (ctx) => {
	const authHeader = ctx.request.headers.get('authorization');
	const token = authHeader?.split(' ')[1];

	if (token) {
		await AuthService.logout(token);
	}

	ctx.json({ success: true, message: 'Logged out successfully' });
});

// Save/Load routes (protected)
app.get('/api/save', authMiddleware, async (ctx) => {
	const player = (ctx as any).player;
	const result = await SaveService.loadSave(player.playerId);

	if (result.success) {
		ctx.json(result);
	} else {
		ctx.status(404).json(result);
	}
});

app.post('/api/save', authMiddleware, async (ctx) => {
	const player = (ctx as any).player;
	const body = await ctx.request.json();
	const saveType = body.saveType || 'auto';

	const result = await SaveService.saveSave(player.playerId, body.saveData, saveType);

	if (result.success) {
		ctx.json(result);
	} else {
		ctx.status(500).json(result);
	}
});

app.get('/api/save/history', authMiddleware, async (ctx) => {
	const player = (ctx as any).player;
	const history = await SaveService.getSaveHistory(player.playerId);
	ctx.json({ success: true, data: history });
});

app.get('/api/save/snapshot/:saveId', authMiddleware, async (ctx) => {
	const player = (ctx as any).player;
	const saveId = ctx.params.saveId;
	const result = await SaveService.loadSnapshot(player.playerId, saveId);

	if (result.success) {
		ctx.json(result);
	} else {
		ctx.status(404).json(result);
	}
});

// Error handling
app.onError((error, ctx) => {
	console.error('[Server Error]', error);
	ctx.status(500).json({
		error: 'Internal Server Error',
		message: error.message,
	});
});

// 404 handler
app.use((ctx) => {
	ctx.status(404).json({
		error: 'Not Found',
		path: ctx.request.url,
	});
});

// Start server
app.listen(PORT, () => {
	console.log('🎮 RPG Game Server');
	console.log(`✓ Server running on http://${HOST}:${PORT}`);
	console.log(`✓ Health check: http://${HOST}:${PORT}/health`);
	console.log(`✓ API test: http://${HOST}:${PORT}/api/test`);
});
