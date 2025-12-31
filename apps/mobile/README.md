# RPG Mobile App

Capacitor-based mobile application for the RPG game supporting iOS and Android.

## Features

- **Touch Controls**: Virtual joystick and touch buttons for mobile gameplay
- **Native Integration**: Push notifications, haptic feedback, status bar customization
- **Platform Adaptation**: Detects and adapts to iOS, Android, or web
- **Lifecycle Management**: Handles app pause/resume, back button
- **Performance Optimized**: Mobile-specific optimizations for smooth gameplay
- **Keyboard Management**: Auto-hide keyboard when needed
- **App State Persistence**: Settings and game state saved locally

## Development

### Prerequisites

- Bun installed
- Android Studio (for Android development)
- Xcode (for iOS development, macOS only)

### Install Dependencies

```bash
cd apps/mobile
bun install
```

### Run in Development Mode

```bash
# Start web dev server
bun run dev

# Or run on Android
bun run run:android

# Or run on iOS (macOS only)
bun run run:ios
```

### Build for Production

```bash
# Build web assets
bun run build

# Sync with native projects
bun run sync

# Or build for Android
bun run build:android

# Or build for iOS
bun run build:ios
```

## Architecture

### Platform Adapter (`src/platform/MobilePlatformAdapter.ts`)
- Platform detection (iOS/Android/web)
- Status bar configuration
- App lifecycle management
- Push notifications
- Haptic feedback
- Keyboard control

### Virtual Joystick (`src/ui/VirtualJoystick.ts`)
- Touch-based movement control
- Normalized x/y output (-1 to 1)
- Visual feedback
- Configurable size and position

### Touch Controls (`src/ui/TouchControls.ts`)
- Configurable action buttons
- Touch event handling
- Press/release callbacks
- Visual feedback

### Main Integration (`src/index.ts`)
- Initializes mobile features
- Sets up controls
- Handles lifecycle events
- Dispatches game events

## Mobile Controls

### Virtual Joystick (Bottom-left)
- Move character by dragging
- Returns to center when released
- Provides normalized directional input

### Action Buttons (Bottom-right)
- **A Button**: Attack action
- **S Button**: Use skill
- **I Button**: Open inventory
- **M Button** (Top-right): Menu

## Capacitor Plugins

The app uses the following Capacitor plugins:

- **@capacitor/app**: App lifecycle and state
- **@capacitor/haptics**: Haptic feedback
- **@capacitor/keyboard**: Keyboard management
- **@capacitor/push-notifications**: Push notifications
- **@capacitor/splash-screen**: Splash screen control
- **@capacitor/status-bar**: Status bar styling

## Usage in Game Code

```typescript
import { MobileGame, mobileAdapter } from '@rpg/mobile';

// Initialize mobile features
const mobileGame = new MobileGame(document.body);

// Check if running on mobile
if (mobileAdapter.isMobilePlatform()) {
  // Show mobile notification
  console.log('Running on:', mobileAdapter.getPlatform());

  // Trigger haptic feedback
  await mobileAdapter.haptic('success');

  // Hide keyboard
  await mobileAdapter.hideKeyboard();
}

// Listen for mobile events
document.addEventListener('joystick-update', (e: CustomEvent) => {
  const { x, y } = e.detail;
  // Move player based on joystick input
});

document.addEventListener('action-attack', () => {
  // Handle attack action
});

document.addEventListener('app-pause', () => {
  // Save game state
});
```

## Events

The mobile app dispatches the following custom events:

### Joystick Events
- `joystick-update`: Fired continuously when joystick is moved
  - `detail: { x: number, y: number, angle: number, distance: number }`

### Action Events
- `action-attack`: Attack button pressed
- `action-skill`: Skill button pressed
- `action-item`: Item button pressed
- `action-menu`: Menu button pressed

### Lifecycle Events
- `app-resume`: App became active
- `app-pause`: App went to background
- `back-button`: Hardware back button pressed (Android)
- `game-resume`: Game should resume
- `game-pause`: Game should pause
- `orientation-change`: Device orientation changed

## Platform-Specific Notes

### Android
- Minimum SDK: 22 (Android 5.1)
- Target SDK: 34 (Android 14)
- Requires Google Play Services for push notifications
- Back button handled by Capacitor
- Build output: APK or AAB

### iOS
- Minimum iOS: 13.0
- Requires Apple Developer account for device testing
- Push notifications require APNS certificates
- No back button (uses navigation gestures)
- Build output: IPA

### Web
- Runs in mobile browsers
- No native features (notifications, haptics)
- Graceful fallbacks for unsupported features
- Virtual controls still available

## File Structure

```
apps/mobile/
├── src/
│   ├── platform/          # Platform adapter
│   │   └── MobilePlatformAdapter.ts
│   ├── ui/                # UI components
│   │   ├── VirtualJoystick.ts
│   │   └── TouchControls.ts
│   └── index.ts           # Main entry point
├── android/               # Android project (generated)
├── ios/                   # iOS project (generated)
├── capacitor.config.ts    # Capacitor configuration
├── vite.config.ts         # Vite bundler config
├── package.json
└── README.md
```

## Building for Distribution

### Android (APK/AAB)

```bash
# Build web assets
bun run build

# Sync with Android project
bun run sync

# Open in Android Studio
bun run open:android

# In Android Studio:
# Build > Generate Signed Bundle / APK
```

### iOS (IPA)

```bash
# Build web assets
bun run build

# Sync with iOS project
bun run sync

# Open in Xcode
bun run open:ios

# In Xcode:
# Product > Archive > Distribute App
```

## Performance Optimization

The mobile app includes several optimizations:

1. **Asset Loading**: Lazy loading and progressive enhancement
2. **Touch Events**: Passive event listeners where possible
3. **Rendering**: RequestAnimationFrame for smooth animations
4. **Memory**: Cleanup on component destruction
5. **Network**: Connection type detection and adaptation

## Troubleshooting

### Android Build Issues
- Ensure Android SDK is installed
- Check `android/app/build.gradle` for version conflicts
- Run `bun run sync` after package changes

### iOS Build Issues
- Ensure Xcode is up to date
- Check code signing settings
- Run `pod install` in `ios/App` if needed

### Push Notifications Not Working
- Android: Check Google Services configuration
- iOS: Verify APNS certificates
- Check permissions are granted

### Haptic Feedback Not Working
- Check device supports haptics
- Verify haptics are enabled in device settings
- Some Android devices have limited haptic support

## Known Issues

- Virtual joystick may interfere with scrolling on some devices
- Push notifications require platform-specific setup
- iOS requires physical device for full testing (simulator limitations)

## Next Steps

1. Implement game-specific UI overlays
2. Add social features (friend list, chat)
3. Optimize asset loading for mobile networks
4. Add offline mode support
5. Implement cloud save synchronization
