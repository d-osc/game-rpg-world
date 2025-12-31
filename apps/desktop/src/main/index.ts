/**
 * Electron Main Process
 * Manages application lifecycle, windows, and native features
 */

import { app, BrowserWindow, Menu, shell, ipcMain, dialog, Notification } from 'electron';
import { autoUpdater } from 'electron-updater';
import * as path from 'path';
import * as fs from 'fs';

// Keep a global reference of the window object
let mainWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;

// Application settings
interface AppSettings {
	windowBounds?: {
		width: number;
		height: number;
		x?: number;
		y?: number;
	};
	fullscreen?: boolean;
	autoUpdate?: boolean;
	notificationsEnabled?: boolean;
}

let appSettings: AppSettings = {
	windowBounds: { width: 1280, height: 720 },
	fullscreen: false,
	autoUpdate: true,
	notificationsEnabled: true,
};

const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');

/**
 * Load settings from file
 */
function loadSettings(): void {
	try {
		if (fs.existsSync(SETTINGS_FILE)) {
			const data = fs.readFileSync(SETTINGS_FILE, 'utf-8');
			appSettings = { ...appSettings, ...JSON.parse(data) };
			console.log('[Main] Settings loaded');
		}
	} catch (error) {
		console.error('[Main] Failed to load settings:', error);
	}
}

/**
 * Save settings to file
 */
function saveSettings(): void {
	try {
		// Save current window bounds
		if (mainWindow && !mainWindow.isDestroyed()) {
			appSettings.windowBounds = mainWindow.getBounds();
			appSettings.fullscreen = mainWindow.isFullScreen();
		}

		fs.writeFileSync(SETTINGS_FILE, JSON.stringify(appSettings, null, 2));
		console.log('[Main] Settings saved');
	} catch (error) {
		console.error('[Main] Failed to save settings:', error);
	}
}

/**
 * Create main window
 */
function createMainWindow(): void {
	loadSettings();

	const bounds = appSettings.windowBounds || { width: 1280, height: 720 };

	mainWindow = new BrowserWindow({
		width: bounds.width,
		height: bounds.height,
		x: bounds.x,
		y: bounds.y,
		minWidth: 800,
		minHeight: 600,
		title: 'RPG Game',
		backgroundColor: '#000000',
		webPreferences: {
			nodeIntegration: false,
			contextIsolation: true,
			preload: path.join(__dirname, '../preload/index.js'),
		},
		show: false, // Don't show until ready
	});

	// Load the app
	const startUrl =
		process.env.NODE_ENV === 'development'
			? 'http://localhost:5173'
			: `file://${path.join(__dirname, '../renderer/index.html')}`;

	mainWindow.loadURL(startUrl);

	// Show window when ready
	mainWindow.once('ready-to-show', () => {
		if (mainWindow) {
			if (appSettings.fullscreen) {
				mainWindow.setFullScreen(true);
			}
			mainWindow.show();
			mainWindow.focus();
		}
	});

	// Open DevTools in development
	if (process.env.NODE_ENV === 'development') {
		mainWindow.webContents.openDevTools();
	}

	// Handle external links
	mainWindow.webContents.setWindowOpenHandler(({ url }) => {
		shell.openExternal(url);
		return { action: 'deny' };
	});

	// Save settings on close
	mainWindow.on('close', () => {
		saveSettings();
	});

	// Cleanup when closed
	mainWindow.on('closed', () => {
		mainWindow = null;
	});

	// Create application menu
	createMenu();

	// Setup auto-updater
	if (appSettings.autoUpdate) {
		setupAutoUpdater();
	}
}

/**
 * Create application menu
 */
function createMenu(): void {
	const template: Electron.MenuItemConstructorOptions[] = [
		{
			label: 'File',
			submenu: [
				{
					label: 'Settings',
					accelerator: 'CmdOrCtrl+,',
					click: () => {
						openSettingsWindow();
					},
				},
				{ type: 'separator' },
				{
					label: 'Quit',
					accelerator: 'CmdOrCtrl+Q',
					click: () => {
						app.quit();
					},
				},
			],
		},
		{
			label: 'View',
			submenu: [
				{
					label: 'Reload',
					accelerator: 'CmdOrCtrl+R',
					click: (item, focusedWindow) => {
						if (focusedWindow) focusedWindow.reload();
					},
				},
				{
					label: 'Toggle Full Screen',
					accelerator: process.platform === 'darwin' ? 'Ctrl+Command+F' : 'F11',
					click: (item, focusedWindow) => {
						if (focusedWindow) focusedWindow.setFullScreen(!focusedWindow.isFullScreen());
					},
				},
				{
					label: 'Toggle Developer Tools',
					accelerator: process.platform === 'darwin' ? 'Alt+Command+I' : 'Ctrl+Shift+I',
					click: (item, focusedWindow) => {
						if (focusedWindow) focusedWindow.webContents.toggleDevTools();
					},
				},
			],
		},
		{
			label: 'Help',
			submenu: [
				{
					label: 'About',
					click: () => {
						dialog.showMessageBox({
							type: 'info',
							title: 'About RPG Game',
							message: 'RPG Game v1.0.0',
							detail: '2D Multiplayer RPG with turn-based combat, multi-job system, and complex economy.',
							buttons: ['OK'],
						});
					},
				},
				{
					label: 'Check for Updates',
					click: () => {
						checkForUpdates();
					},
				},
			],
		},
	];

	const menu = Menu.buildFromTemplate(template);
	Menu.setApplicationMenu(menu);
}

/**
 * Open settings window
 */
function openSettingsWindow(): void {
	if (settingsWindow) {
		settingsWindow.focus();
		return;
	}

	settingsWindow = new BrowserWindow({
		width: 600,
		height: 400,
		title: 'Settings',
		parent: mainWindow || undefined,
		modal: true,
		resizable: false,
		webPreferences: {
			nodeIntegration: false,
			contextIsolation: true,
			preload: path.join(__dirname, '../preload/index.js'),
		},
	});

	// Load settings page (simple HTML for now)
	settingsWindow.loadURL(`data:text/html,
		<html>
		<head>
			<title>Settings</title>
			<style>
				body {
					font-family: Arial, sans-serif;
					padding: 20px;
					background: #1a1a1a;
					color: white;
				}
				h1 { margin-top: 0; }
				.setting {
					margin: 20px 0;
					padding: 15px;
					background: #2a2a2a;
					border-radius: 8px;
				}
				label {
					display: block;
					margin-bottom: 5px;
					font-weight: bold;
				}
				input[type="checkbox"] {
					margin-right: 10px;
				}
				button {
					margin-top: 20px;
					padding: 10px 20px;
					background: #667eea;
					color: white;
					border: none;
					border-radius: 4px;
					cursor: pointer;
					font-size: 14px;
				}
				button:hover {
					background: #5568d3;
				}
			</style>
		</head>
		<body>
			<h1>Settings</h1>
			<div class="setting">
				<label>
					<input type="checkbox" id="autoUpdate" ${appSettings.autoUpdate ? 'checked' : ''}>
					Automatic Updates
				</label>
			</div>
			<div class="setting">
				<label>
					<input type="checkbox" id="notifications" ${appSettings.notificationsEnabled ? 'checked' : ''}>
					Desktop Notifications
				</label>
			</div>
			<button onclick="saveSettings()">Save Settings</button>
			<script>
				function saveSettings() {
					const autoUpdate = document.getElementById('autoUpdate').checked;
					const notifications = document.getElementById('notifications').checked;
					window.electronAPI.saveSettings({ autoUpdate, notifications });
				}
			</script>
		</body>
		</html>
	`);

	settingsWindow.on('closed', () => {
		settingsWindow = null;
	});
}

/**
 * Setup auto-updater
 */
function setupAutoUpdater(): void {
	autoUpdater.on('update-available', () => {
		console.log('[AutoUpdater] Update available');
		if (appSettings.notificationsEnabled) {
			showNotification('Update Available', 'A new version is being downloaded...');
		}
	});

	autoUpdater.on('update-downloaded', () => {
		console.log('[AutoUpdater] Update downloaded');
		dialog
			.showMessageBox({
				type: 'info',
				title: 'Update Ready',
				message: 'A new version has been downloaded. Restart to apply the update?',
				buttons: ['Restart', 'Later'],
			})
			.then((result) => {
				if (result.response === 0) {
					autoUpdater.quitAndInstall();
				}
			});
	});

	autoUpdater.on('error', (error) => {
		console.error('[AutoUpdater] Error:', error);
	});

	// Check for updates on startup (after 3 seconds)
	setTimeout(() => {
		checkForUpdates();
	}, 3000);
}

/**
 * Check for updates manually
 */
function checkForUpdates(): void {
	autoUpdater.checkForUpdates().catch((error) => {
		console.error('[AutoUpdater] Check failed:', error);
		dialog.showMessageBox({
			type: 'info',
			title: 'No Updates',
			message: 'You are running the latest version.',
			buttons: ['OK'],
		});
	});
}

/**
 * Show desktop notification
 */
function showNotification(title: string, body: string): void {
	if (appSettings.notificationsEnabled && Notification.isSupported()) {
		new Notification({
			title,
			body,
		}).show();
	}
}

/**
 * IPC Handlers
 */
function setupIPC(): void {
	// Save settings from renderer
	ipcMain.handle('save-settings', (event, settings) => {
		appSettings = { ...appSettings, ...settings };
		saveSettings();
		return { success: true };
	});

	// Get settings
	ipcMain.handle('get-settings', () => {
		return appSettings;
	});

	// Show notification
	ipcMain.handle('show-notification', (event, { title, body }) => {
		showNotification(title, body);
		return { success: true };
	});

	// Toggle fullscreen
	ipcMain.handle('toggle-fullscreen', () => {
		if (mainWindow) {
			const isFullScreen = mainWindow.isFullScreen();
			mainWindow.setFullScreen(!isFullScreen);
			return { fullscreen: !isFullScreen };
		}
		return { fullscreen: false };
	});

	// Open external link
	ipcMain.handle('open-external', (event, url: string) => {
		shell.openExternal(url);
		return { success: true };
	});

	// Get app version
	ipcMain.handle('get-app-version', () => {
		return app.getVersion();
	});
}

/**
 * App ready
 */
app.whenReady().then(() => {
	createMainWindow();
	setupIPC();

	app.on('activate', () => {
		// On macOS re-create window when dock icon is clicked
		if (BrowserWindow.getAllWindows().length === 0) {
			createMainWindow();
		}
	});
});

/**
 * Quit when all windows are closed
 */
app.on('window-all-closed', () => {
	// On macOS, keep app running until Cmd+Q
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

/**
 * Before quit
 */
app.on('before-quit', () => {
	saveSettings();
});

/**
 * Cleanup on quit
 */
app.on('quit', () => {
	console.log('[Main] App quit');
});
