// Shared constants

export const GAME_CONFIG = {
  FPS: 60,
  CANVAS_WIDTH: 1280,
  CANVAS_HEIGHT: 720,
} as const;

export const NETWORK_CONFIG = {
  UPDATE_RATE: 10, // Updates per second
  TIMEOUT: 30000, // 30 seconds
} as const;
