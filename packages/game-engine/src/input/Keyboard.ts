/**
 * Keyboard
 * Keyboard input management
 */

export class Keyboard {
  private static _instance: Keyboard;

  // Key states
  private keys: Map<string, boolean> = new Map();
  private keysPressed: Map<string, boolean> = new Map();
  private keysReleased: Map<string, boolean> = new Map();
  private keysPreviousFrame: Map<string, boolean> = new Map();

  // Event listeners
  private onKeyDownListeners: Map<string, ((event: KeyboardEvent) => void)[]> = new Map();
  private onKeyUpListeners: Map<string, ((event: KeyboardEvent) => void)[]> = new Map();

  // Input blocking
  private isEnabled: boolean = true;

  private constructor() {
    this.setupEventListeners();
  }

  static getInstance(): Keyboard {
    if (!Keyboard._instance) {
      Keyboard._instance = new Keyboard();
    }
    return Keyboard._instance;
  }

  /**
   * Setup keyboard event listeners
   */
  private setupEventListeners(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('keydown', (event) => {
      if (!this.isEnabled) return;

      const key = event.key.toLowerCase();

      // Set key as pressed
      if (!this.keys.get(key)) {
        this.keysPressed.set(key, true);
      }
      this.keys.set(key, true);

      // Call listeners
      const listeners = this.onKeyDownListeners.get(key);
      if (listeners) {
        for (const listener of listeners) {
          listener(event);
        }
      }
    });

    window.addEventListener('keyup', (event) => {
      if (!this.isEnabled) return;

      const key = event.key.toLowerCase();

      this.keys.set(key, false);
      this.keysReleased.set(key, true);

      // Call listeners
      const listeners = this.onKeyUpListeners.get(key);
      if (listeners) {
        for (const listener of listeners) {
          listener(event);
        }
      }
    });

    // Handle window blur (reset all keys)
    window.addEventListener('blur', () => {
      this.resetAll();
    });
  }

  /**
   * Update keyboard state (call once per frame)
   */
  update(): void {
    // Clear pressed/released flags from previous frame
    this.keysPressed.clear();
    this.keysReleased.clear();

    // Copy current state to previous frame
    this.keysPreviousFrame = new Map(this.keys);
  }

  /**
   * Check if key is currently held down
   */
  isKeyDown(key: string): boolean {
    return this.keys.get(key.toLowerCase()) ?? false;
  }

  /**
   * Check if key was just pressed this frame
   */
  isKeyPressed(key: string): boolean {
    return this.keysPressed.get(key.toLowerCase()) ?? false;
  }

  /**
   * Check if key was just released this frame
   */
  isKeyReleased(key: string): boolean {
    return this.keysReleased.get(key.toLowerCase()) ?? false;
  }

  /**
   * Check if any key is down
   */
  isAnyKeyDown(): boolean {
    for (const pressed of this.keys.values()) {
      if (pressed) return true;
    }
    return false;
  }

  /**
   * Get all currently pressed keys
   */
  getPressedKeys(): string[] {
    const pressed: string[] = [];
    for (const [key, isPressed] of this.keys.entries()) {
      if (isPressed) pressed.push(key);
    }
    return pressed;
  }

  /**
   * Add key down listener
   */
  onKeyDown(key: string, callback: (event: KeyboardEvent) => void): void {
    const lowerKey = key.toLowerCase();

    if (!this.onKeyDownListeners.has(lowerKey)) {
      this.onKeyDownListeners.set(lowerKey, []);
    }

    this.onKeyDownListeners.get(lowerKey)!.push(callback);
  }

  /**
   * Add key up listener
   */
  onKeyUp(key: string, callback: (event: KeyboardEvent) => void): void {
    const lowerKey = key.toLowerCase();

    if (!this.onKeyUpListeners.has(lowerKey)) {
      this.onKeyUpListeners.set(lowerKey, []);
    }

    this.onKeyUpListeners.get(lowerKey)!.push(callback);
  }

  /**
   * Remove key down listener
   */
  removeKeyDownListener(key: string, callback: (event: KeyboardEvent) => void): void {
    const lowerKey = key.toLowerCase();
    const listeners = this.onKeyDownListeners.get(lowerKey);

    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Remove key up listener
   */
  removeKeyUpListener(key: string, callback: (event: KeyboardEvent) => void): void {
    const lowerKey = key.toLowerCase();
    const listeners = this.onKeyUpListeners.get(lowerKey);

    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Enable keyboard input
   */
  enable(): void {
    this.isEnabled = true;
  }

  /**
   * Disable keyboard input
   */
  disable(): void {
    this.isEnabled = false;
    this.resetAll();
  }

  /**
   * Reset all key states
   */
  resetAll(): void {
    this.keys.clear();
    this.keysPressed.clear();
    this.keysReleased.clear();
    this.keysPreviousFrame.clear();
  }

  /**
   * Common key codes
   */
  static readonly Keys = {
    // Arrows
    ARROW_UP: 'arrowup',
    ARROW_DOWN: 'arrowdown',
    ARROW_LEFT: 'arrowleft',
    ARROW_RIGHT: 'arrowright',

    // WASD
    W: 'w',
    A: 'a',
    S: 's',
    D: 'd',

    // Space and Enter
    SPACE: ' ',
    ENTER: 'enter',
    ESCAPE: 'escape',
    TAB: 'tab',
    SHIFT: 'shift',
    CONTROL: 'control',
    ALT: 'alt',

    // Numbers
    NUM_0: '0',
    NUM_1: '1',
    NUM_2: '2',
    NUM_3: '3',
    NUM_4: '4',
    NUM_5: '5',
    NUM_6: '6',
    NUM_7: '7',
    NUM_8: '8',
    NUM_9: '9',

    // Function keys
    F1: 'f1',
    F2: 'f2',
    F3: 'f3',
    F4: 'f4',
    F5: 'f5',
    F6: 'f6',
    F7: 'f7',
    F8: 'f8',
    F9: 'f9',
    F10: 'f10',
    F11: 'f11',
    F12: 'f12',
  } as const;
}

// Export singleton instance
export const keyboard = Keyboard.getInstance();
