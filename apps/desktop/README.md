# RPG Desktop App

Electron-based desktop application for the RPG game.

## Features

- **Native Desktop Experience**: Full Electron app with native menus and notifications
- **Window Management**: Persistent window size/position, fullscreen support
- **Auto-Updates**: Automatic update checking and installation (electron-updater)
- **Settings Persistence**: Settings saved to local storage
- **Platform Integration**: Native file dialogs, notifications, and external link handling
- **Keyboard Shortcuts**: F11 for fullscreen, Ctrl+R for reload, etc.
- **Cross-Platform**: Builds for Windows, macOS, and Linux

## Development

### Prerequisites

- Bun installed
- Electron dependencies installed

### Install Dependencies

```bash
cd apps/desktop
bun install
```

### Run in Development Mode

```bash
# Build and run with Electron
bun run dev

# Or run the web app separately and use development mode
cd ../web
bun run dev
# Then in another terminal:
cd ../desktop
NODE_ENV=development bun run dev
```

### Build for Production

```bash
# Build all (main, preload, renderer)
bun run build

# Build specific parts
bun run build:main
bun run build:preload
bun run build:renderer
```

## Distribution

### Build Installers

```bash
# Build for all platforms (requires platform-specific setup)
bun run dist

# Build for Windows
bun run dist:win

# Build for macOS
bun run dist:mac

# Build for Linux
bun run dist:linux
```

### Outputs

Installers will be created in the `release/` directory:
- Windows: `.exe` (NSIS installer)
- macOS: `.dmg`
- Linux: `.AppImage`

## Architecture

### Main Process (`src/main/index.ts`)
- Application lifecycle management
- Window creation and management
- Native menus
- Auto-updater
- IPC handlers
- Settings persistence

### Preload Script (`src/preload/index.ts`)
- Secure bridge between main and renderer
- Exposes safe APIs via `contextBridge`
- No node integration in renderer for security

### Renderer Process (`src/renderer/index.ts`)
- Desktop platform adapter
- Integrates Electron features with game code
- Provides fallbacks for web version

## IPC API

The preload script exposes the following APIs to the renderer:

```typescript
window.electronAPI = {
  // Settings
  saveSettings(settings: any): Promise<any>
  getSettings(): Promise<any>

  // Notifications
  showNotification(title: string, body: string): Promise<any>

  // Window
  toggleFullscreen(): Promise<any>

  // External
  openExternal(url: string): Promise<any>

  // Info
  getAppVersion(): Promise<string>
  platform: string
}
```

## Usage in Game Code

```typescript
import desktopAdapter from '@rpg/desktop/renderer';

// Check if running in desktop
if (desktopAdapter.isDesktop()) {
  // Show desktop notification
  await desktopAdapter.showNotification('Match Found!', 'Your PvP match is ready');

  // Toggle fullscreen
  await desktopAdapter.toggleFullscreen();

  // Open external link
  await desktopAdapter.openExternal('https://example.com');
}
```

## Auto-Updates

The app automatically checks for updates on startup and periodically. When an update is available:

1. Downloads in the background
2. Shows notification when ready
3. Prompts user to restart
4. Installs update on restart

Configure in `package.json`:
```json
{
  "build": {
    "publish": {
      "provider": "github",
      "owner": "your-username",
      "repo": "rpg"
    }
  }
}
```

## Platform-Specific Notes

### Windows
- Uses NSIS installer
- Requires code signing for Windows SmartScreen
- Icon: `build/icon.ico` (256x256)

### macOS
- Creates DMG file
- Requires code signing for Gatekeeper
- Icon: `build/icon.icns`
- Universal binary support (x64 + arm64)

### Linux
- Creates AppImage
- Icon: `build/icon.png` (512x512)
- No code signing required

## File Structure

```
apps/desktop/
├── src/
│   ├── main/          # Main process
│   │   └── index.ts
│   ├── preload/       # Preload script
│   │   └── index.ts
│   └── renderer/      # Renderer process
│       └── index.ts
├── build/             # Build resources (icons, etc.)
├── dist/              # Build output
├── release/           # Distribution packages
├── package.json
└── README.md
```

## Security

- **Context Isolation**: Enabled for security
- **Node Integration**: Disabled in renderer
- **Secure IPC**: Only whitelisted APIs exposed
- **CSP**: Content Security Policy enforced
- **External Links**: Opened in default browser, not in-app

## Known Issues

- Auto-update requires proper release configuration
- macOS requires notarization for distribution
- Windows SmartScreen may warn without code signing
