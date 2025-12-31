/**
 * Electron Preload Script
 * Exposes safe APIs to the renderer process
 */

import { contextBridge, ipcRenderer } from 'electron';

/**
 * Electron API exposed to renderer
 */
const electronAPI = {
	/**
	 * Save settings
	 */
	saveSettings: (settings: any) => ipcRenderer.invoke('save-settings', settings),

	/**
	 * Get settings
	 */
	getSettings: () => ipcRenderer.invoke('get-settings'),

	/**
	 * Show desktop notification
	 */
	showNotification: (title: string, body: string) => ipcRenderer.invoke('show-notification', { title, body }),

	/**
	 * Toggle fullscreen
	 */
	toggleFullscreen: () => ipcRenderer.invoke('toggle-fullscreen'),

	/**
	 * Open external link
	 */
	openExternal: (url: string) => ipcRenderer.invoke('open-external', url),

	/**
	 * Get app version
	 */
	getAppVersion: () => ipcRenderer.invoke('get-app-version'),

	/**
	 * Platform info
	 */
	platform: process.platform,
};

/**
 * Expose API to renderer through contextBridge
 */
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

/**
 * TypeScript types for window.electronAPI
 */
export type ElectronAPI = typeof electronAPI;

declare global {
	interface Window {
		electronAPI: ElectronAPI;
	}
}
