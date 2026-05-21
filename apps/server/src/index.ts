/**
 * RPG Game Server
 * Elit-based backend server for authentication, save/load, and multiplayer coordination
 */

import { createServer } from 'http';
import { ServerRouter } from 'elit/server';
import { createWebSocketServer } from 'elit/ws';
import { testConnection } from './database/index.ts';
import { AuthService } from './auth/index.ts';
import { authMiddleware } from './auth/middleware.ts';
import { SaveService } from './save/index.ts';
import { GameServer } from './game/GameServer.ts';

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || 'localhost';

const router = new ServerRouter();

console.log('[RPG Server] Initializing...');

testConnection().catch((error: any) => {
	console.error('[RPG Server] Database connection failed:', error);
});

// Health check
router.get('/health', async (ctx: any) => {
	ctx.res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'rpg-game-server', version: '0.1.0' });
});

router.get('/api/test', async (ctx: any) => {
	ctx.res.json({ message: 'API is working!', timestamp: new Date().toISOString() });
});

// Auth routes
router.post('/api/auth/register', async (ctx: any) => {
	const result = await AuthService.register(ctx.body);
	ctx.res.json(result, result.success ? 201 : 400);
});

router.post('/api/auth/login', async (ctx: any) => {
	const result = await AuthService.login(ctx.body);
	ctx.res.json(result, result.success ? 200 : 401);
});

router.post('/api/auth/logout', authMiddleware, async (ctx: any) => {
	const authHeader = ctx.req.headers.get?.('authorization') || ctx.req.headers['authorization'] as string;
	const token = authHeader?.split(' ')[1];
	if (token) await AuthService.logout(token);
	ctx.res.json({ success: true, message: 'Logged out successfully' });
});

// Save/Load routes
router.get('/api/save', authMiddleware, async (ctx: any) => {
	const player = (ctx as any).player;
	const result = await SaveService.loadSave(player.playerId);
	ctx.res.json(result, result.success ? 200 : 404);
});

router.post('/api/save', authMiddleware, async (ctx: any) => {
	const player = (ctx as any).player;
	const saveType = ctx.body.saveType || 'auto';
	const result = await SaveService.saveSave(player.playerId, ctx.body.saveData, saveType);
	ctx.res.json(result, result.success ? 200 : 500);
});

router.get('/api/save/history', authMiddleware, async (ctx: any) => {
	const player = (ctx as any).player;
	const history = await SaveService.getSaveHistory(player.playerId);
	ctx.res.json({ success: true, data: history });
});

router.get('/api/save/snapshot/:saveId', authMiddleware, async (ctx: any) => {
	const player = (ctx as any).player;
	const result = await SaveService.loadSnapshot(player.playerId, ctx.params.saveId);
	ctx.res.json(result, result.success ? 200 : 404);
});

// Stats
router.get('/api/stats', async (ctx: any) => {
	ctx.res.json({ connections: gameServer.getConnectionCount(), zones: gameServer.getZoneCount(), zoneInfo: gameServer.getZoneInfo() });
});

// Signaling server
const WS_PORT = parseInt(process.env.WS_PORT || '3001', 10);
const gameServer = new GameServer();

const wss = createWebSocketServer({ port: WS_PORT }, () => {
	console.log(`WebSocket server running on ws://${HOST}:${WS_PORT}`);
});

wss.on('connection', async (ws: any, request: any) => {
	const url = new URL(request.url || '', `http://${request.headers.host}`);
	const token = url.searchParams.get('token');
	if (!token) { ws.close(1008, 'No authentication token'); return; }
	const payload = await AuthService.verifyToken(token);
	if (!payload) { ws.close(1008, 'Invalid authentication token'); return; }
	gameServer.handleConnection(ws, payload.playerId, payload.username);
});

// Position broadcast loop at 10Hz
setInterval(() => {
	gameServer.broadcastPositions();
}, 100);

// Start HTTP server
const httpServer = createServer((req, res) => router.handle(req, res));
httpServer.listen(PORT, () => {
	console.log('RPG Game Server');
	console.log(`Server running on http://${HOST}:${PORT}`);
	console.log(`Health check: http://${HOST}:${PORT}/health`);
});
