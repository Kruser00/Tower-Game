export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER'
}

export interface GameConfig {
  blockSize: { x: number, y: number, z: number };
  moveSpeed: number;
  cameraZoom: number;
}
