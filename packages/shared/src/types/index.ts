// Shared TypeScript types and interfaces

export interface Vector2 {
  x: number;
  y: number;
}

export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Transform {
  position: Vector2;
  rotation: number;
  scale: Vector2;
}
