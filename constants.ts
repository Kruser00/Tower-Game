
export const COLORS = {
  bgGradientStart: 0xff9966,
  bgGradientEnd: 0xff5e62,
  base: 0xdcae96, // Sandy base
  perfect: 0xffd700, // Gold for particles
};

// Persian/Isfahan Palette: Sand -> Turquoise -> Deep Blue
export const BLOCK_PALETTE = [
  { r: 230, g: 210, b: 181 }, // Sand
  { r: 216, g: 191, b: 153 },
  { r: 64,  g: 224, b: 208 }, // Turquoise
  { r: 0,   g: 119, b: 190 }, // Ocean Blue
  { r: 25,  g: 25,  b: 112 }, // Midnight Blue
];

export const GAME_CONFIG = {
  defaultBlockSize: 3,
  blockHeight: 1,
  moveSpeed: 0.15,
  debrisSpeed: 0.2,
  cameraLiftSpeed: 0.1,
  
  // Difficulty Scaling
  errorTolerance: 0.2, // Final difficulty (hard)
  initialErrorTolerance: 0.6, // Starting difficulty (easy)
  difficultyRamp: 15, // Score at which difficulty hits max
  
  comboThreshold: 3,   // How many perfects to grow the block
  growthFactor: 0.5,   // How much to grow on combo
};
