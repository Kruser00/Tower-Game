import * as THREE from 'three';
import { GAME_CONFIG, BLOCK_PALETTE, COLORS } from '../constants';
import { SoundManager } from './SoundManager';

export class GameEngine {
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private renderer: THREE.WebGLRenderer;
  private container: HTMLElement;
  private soundManager: SoundManager;
  private resizeObserver: ResizeObserver;
  
  private stack: THREE.Mesh[] = [];
  private debris: { mesh: THREE.Mesh, velocity: THREE.Vector3, rotVelocity: THREE.Vector3 }[] = [];
  private particles: { mesh: THREE.Mesh, velocity: THREE.Vector3, life: number }[] = [];
  
  private animationId: number | null = null;
  private isGameRunning: boolean = false;
  
  // Game State
  private score: number = 0;
  private axis: 'x' | 'z' = 'x';
  private direction: number = 1; 
  private currentBlock: THREE.Mesh | null = null;
  private comboCounter: number = 0; // Track consecutive perfect drops
  
  // Callbacks
  public onScoreUpdate: (score: number, multiplier: number) => void = () => {};
  public onGameOver: (finalScore: number) => void = () => {};

  constructor(container: HTMLElement) {
    this.container = container;
    this.soundManager = new SoundManager();
    
    // Scene Setup
    this.scene = new THREE.Scene();
    
    // 1. Lighting Upgrade
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);
    
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight.position.set(15, 30, 20);
    dirLight.castShadow = true;
    
    // Optimize shadow map
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 500;
    const shadowSize = 25;
    dirLight.shadow.camera.left = -shadowSize;
    dirLight.shadow.camera.right = shadowSize;
    dirLight.shadow.camera.top = shadowSize;
    dirLight.shadow.camera.bottom = -shadowSize;
    
    this.scene.add(dirLight);

    // Camera Setup - Initialize with dummy values, will be fixed by handleResize
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 1000);
    this.camera.position.set(20, 20, 20);
    this.camera.lookAt(0, 0, 0);

    // Renderer Setup
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0); 
    
    // Enable Shadows
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    container.appendChild(this.renderer.domElement);

    // Robust Resizing
    this.handleResize = this.handleResize.bind(this);
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);
    
    // Initial Resize
    this.handleResize();
    
    // Start idle animation loop immediately to render scene (even if empty or just base)
    this.animate();

    // Show a base block immediately so the screen isn't empty
    this.spawnBaseBlock();
  }

  private handleResize() {
    if (!this.container) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    if (width === 0 || height === 0) return;

    const aspect = width / height;
    const d = aspect < 1 ? 12 : 9; 
    
    this.camera.left = -d * aspect;
    this.camera.right = d * aspect;
    this.camera.top = d;
    this.camera.bottom = -d;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private getLayerColor(layer: number): THREE.Color {
    const cycleLength = 20;
    const progress = (layer % cycleLength) / cycleLength;
    const index = Math.min(Math.floor(progress * (BLOCK_PALETTE.length - 1)), BLOCK_PALETTE.length - 2);
    const colorStart = BLOCK_PALETTE[index];
    const colorEnd = BLOCK_PALETTE[index + 1];
    const mix = (progress * (BLOCK_PALETTE.length - 1)) - index;

    const r = colorStart.r + (colorEnd.r - colorStart.r) * mix;
    const g = colorStart.g + (colorEnd.g - colorStart.g) * mix;
    const b = colorStart.b + (colorEnd.b - colorStart.b) * mix;

    return new THREE.Color(`rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`);
  }

  private spawnBaseBlock() {
    // Clear existing
    this.cleanup();
    
    const geometry = new THREE.BoxGeometry(
      GAME_CONFIG.defaultBlockSize, 
      GAME_CONFIG.blockHeight, 
      GAME_CONFIG.defaultBlockSize
    );
    const material = new THREE.MeshStandardMaterial({ 
      color: this.getLayerColor(0),
      roughness: 0.3,
      metalness: 0.1
    });
    const baseBlock = new THREE.Mesh(geometry, material);
    baseBlock.position.set(0, 0, 0);
    baseBlock.receiveShadow = true;
    this.scene.add(baseBlock);
    this.stack.push(baseBlock);
    
    // Reset camera
    this.camera.position.set(20, 20, 20);
    this.camera.lookAt(0, 0, 0);
  }

  public startGame() {
    this.cleanup();
    this.soundManager.resume();
    this.isGameRunning = true;
    this.score = 0;
    this.axis = 'x';
    this.direction = 1;
    this.comboCounter = 0;
    this.onScoreUpdate(0, 1);

    this.spawnBaseBlock(); // Re-add base block
    this.spawnNextBlock();
  }

  // Revive Mechanic: Undo the Game Over state
  public reviveGame() {
    if (this.isGameRunning) return; 

    // 1. Remove the "Game Over" debris
    if (this.debris.length > 0) {
      const lastDebris = this.debris.pop();
      if (lastDebris) {
        this.scene.remove(lastDebris.mesh);
        lastDebris.mesh.geometry.dispose();
      }
    }

    // 2. Reset State
    this.isGameRunning = true;
    this.currentBlock = null; 
    
    // 3. Reset Music/Sound
    this.soundManager.resume();

    // 4. Spawn a fresh block on top
    this.spawnNextBlock();
  }

  private spawnNextBlock() {
    const prevBlock = this.stack[this.stack.length - 1];
    const geometry = prevBlock.geometry as THREE.BoxGeometry;
    
    let width = geometry.parameters.width;
    let depth = geometry.parameters.depth;

    if (this.comboCounter >= GAME_CONFIG.comboThreshold) {
      if (width < GAME_CONFIG.defaultBlockSize) width = Math.min(GAME_CONFIG.defaultBlockSize, width + GAME_CONFIG.growthFactor);
      if (depth < GAME_CONFIG.defaultBlockSize) depth = Math.min(GAME_CONFIG.defaultBlockSize, depth + GAME_CONFIG.growthFactor);
    }

    const newGeometry = new THREE.BoxGeometry(width, GAME_CONFIG.blockHeight, depth);
    
    const material = new THREE.MeshStandardMaterial({ 
      color: this.getLayerColor(this.score + 1),
      roughness: 0.3,
      metalness: 0.1
    });
    
    this.currentBlock = new THREE.Mesh(newGeometry, material);
    this.currentBlock.castShadow = true;
    this.currentBlock.receiveShadow = true;

    const spawnDist = 12; 
    if (this.axis === 'x') {
      this.currentBlock.position.set(
        prevBlock.position.x - spawnDist,
        prevBlock.position.y + GAME_CONFIG.blockHeight,
        prevBlock.position.z
      );
    } else {
      this.currentBlock.position.set(
        prevBlock.position.x,
        prevBlock.position.y + GAME_CONFIG.blockHeight,
        prevBlock.position.z - spawnDist
      );
    }

    this.scene.add(this.currentBlock);
  }

  private triggerHaptic(type: 'light' | 'heavy') {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      if (type === 'light') navigator.vibrate(15);
      if (type === 'heavy') navigator.vibrate(200);
    }
  }

  public placeBlock() {
    if (!this.isGameRunning || !this.currentBlock) return;

    const current = this.currentBlock;
    const prev = this.stack[this.stack.length - 1];
    const prevPos = prev.position;
    const currPos = current.position;
    
    const prevGeo = prev.geometry as THREE.BoxGeometry;
    const currentGeo = current.geometry as THREE.BoxGeometry;
    
    const prevWidth = prevGeo.parameters.width;
    const prevDepth = prevGeo.parameters.depth;
    const currentWidth = currentGeo.parameters.width;
    const currentDepth = currentGeo.parameters.depth;

    let delta: number, overlap: number;
    let newWidth = currentWidth; 
    let newDepth = currentDepth;

    if (this.axis === 'x') {
      delta = currPos.x - prevPos.x;
    } else {
      delta = currPos.z - prevPos.z;
    }

    let currentTolerance = GAME_CONFIG.errorTolerance;
    if (this.score < GAME_CONFIG.difficultyRamp) {
      const progress = this.score / GAME_CONFIG.difficultyRamp;
      currentTolerance = GAME_CONFIG.initialErrorTolerance - (progress * (GAME_CONFIG.initialErrorTolerance - GAME_CONFIG.errorTolerance));
    }

    // "Perfect" Snap Mechanic
    if (Math.abs(delta) < currentTolerance) {
      if (this.axis === 'x') current.position.x = prevPos.x;
      else current.position.z = prevPos.z;
      
      delta = 0; 
      this.comboCounter++;
      this.spawnPerfectParticles(current.position, currentWidth, currentDepth);
      this.soundManager.playPerfect(this.comboCounter);
      this.triggerHaptic('light'); 
      
      newWidth = currentWidth;
      newDepth = currentDepth;
      
      if (this.axis === 'x') overlap = currentWidth;
      else overlap = currentDepth;

    } else {
      this.comboCounter = 0; 
      this.soundManager.playPlace();
      this.triggerHaptic('light'); 
      
      if (this.axis === 'x') {
        overlap = prevWidth - Math.abs(delta);
        newWidth = overlap;
        newDepth = currentDepth; 
      } else {
        overlap = prevDepth - Math.abs(delta);
        newWidth = currentWidth; 
        newDepth = overlap;
      }
    }

    if (overlap > 0) {
      this.handleSuccessfulPlacement(delta, newWidth, newDepth, prevPos);
    } else {
      this.handleGameOver();
    }
  }

  private spawnPerfectParticles(pos: THREE.Vector3, width: number, depth: number) {
    const particleCount = 20;
    const color = COLORS.perfect;

    for (let i = 0; i < particleCount; i++) {
      const geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
      const material = new THREE.MeshBasicMaterial({ color, transparent: true });

      const mesh = new THREE.Mesh(geometry, material);
      const spreadX = (Math.random() - 0.5) * width;
      const spreadZ = (Math.random() - 0.5) * depth;

      mesh.position.set(
        pos.x + spreadX,
        pos.y + 0.5, 
        pos.z + spreadZ
      );
      
      this.scene.add(mesh);
      
      const velocity = new THREE.Vector3(spreadX, 2, spreadZ).normalize().multiplyScalar(0.2 + Math.random() * 0.2);
      
      this.particles.push({
        mesh,
        velocity,
        life: 1.0 + Math.random() * 0.5
      });
    }
  }

  private handleSuccessfulPlacement(
    delta: number, 
    newWidth: number, 
    newDepth: number, 
    prevPos: THREE.Vector3
  ) {
    if (!this.currentBlock) return;
    
    const newGeo = new THREE.BoxGeometry(newWidth, GAME_CONFIG.blockHeight, newDepth);
    this.currentBlock.geometry.dispose();
    this.currentBlock.geometry = newGeo;

    if (this.axis === 'x') {
      const shift = delta / 2;
      this.currentBlock.position.x = prevPos.x + shift;
    } else {
      const shift = delta / 2;
      this.currentBlock.position.z = prevPos.z + shift;
    }

    if (delta !== 0) {
        const dWidth = this.axis === 'x' ? Math.abs(delta) : newWidth;
        const dDepth = this.axis === 'z' ? Math.abs(delta) : newDepth;
        
        if (dWidth > 0.05 && dDepth > 0.05) {
            const debrisGeo = new THREE.BoxGeometry(dWidth, GAME_CONFIG.blockHeight, dDepth);
            const debrisMat = (this.currentBlock.material as THREE.Material).clone();
            const debris = new THREE.Mesh(debrisGeo, debrisMat);
            debris.castShadow = true;
            debris.receiveShadow = true;
            
            if (this.axis === 'x') {
                const debrisX = delta > 0 
                ? this.currentBlock.position.x + (newWidth / 2) + (dWidth / 2)
                : this.currentBlock.position.x - (newWidth / 2) - (dWidth / 2);
                debris.position.set(debrisX, this.currentBlock.position.y, this.currentBlock.position.z);
            } else {
                const debrisZ = delta > 0
                ? this.currentBlock.position.z + (newDepth / 2) + (dDepth / 2)
                : this.currentBlock.position.z - (newDepth / 2) - (dDepth / 2);
                debris.position.set(this.currentBlock.position.x, this.currentBlock.position.y, debrisZ);
            }
            
            this.scene.add(debris);

            const vx = this.axis === 'x' ? delta * 0.3 + (delta > 0 ? 0.1 : -0.1) : (Math.random() - 0.5) * 0.1;
            const vz = this.axis === 'z' ? delta * 0.3 + (delta > 0 ? 0.1 : -0.1) : (Math.random() - 0.5) * 0.1;
            const vy = -0.1 - Math.random() * 0.3;
            
            this.debris.push({
                mesh: debris,
                velocity: new THREE.Vector3(vx, vy, vz),
                rotVelocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 0.3,
                    (Math.random() - 0.5) * 0.1,
                    (Math.random() - 0.5) * 0.3
                )
            });
        }
    }

    const multiplier = this.comboCounter >= GAME_CONFIG.comboThreshold 
      ? Math.floor(this.comboCounter / GAME_CONFIG.comboThreshold) + 1 
      : 1;

    this.stack.push(this.currentBlock);
    this.score += multiplier;
    this.onScoreUpdate(this.score, multiplier);
    this.axis = this.axis === 'x' ? 'z' : 'x';
    this.spawnNextBlock();
  }

  private handleGameOver() {
    this.isGameRunning = false;
    this.soundManager.playGameOver();
    this.triggerHaptic('heavy');
    
    if (this.currentBlock) {
      const dirX = this.axis === 'x' ? this.direction : 0;
      const dirZ = this.axis === 'z' ? this.direction : 0;

      this.debris.push({
        mesh: this.currentBlock,
        velocity: new THREE.Vector3(dirX * 0.2, -0.5, dirZ * 0.2),
        rotVelocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.3, 
          (Math.random() - 0.5) * 0.1, 
          (Math.random() - 0.5) * 0.3
        )
      });
    }
    this.onGameOver(this.score);
  }

  private animate = () => {
    if (!this.container) return; 

    // Always render the scene, even if game is not running (e.g. Menu with just base block)
    this.renderer.render(this.scene, this.camera);
    
    if (this.isGameRunning && this.currentBlock) {
      const speed = GAME_CONFIG.moveSpeed + (this.score * 0.005); 
      const actualSpeed = Math.min(speed, 0.4); 

      if (this.axis === 'x') {
        this.currentBlock.position.x += actualSpeed * this.direction;
        if (Math.abs(this.currentBlock.position.x - this.stack[this.stack.length - 1].position.x) > 13) {
           this.direction *= -1;
        }
      } else {
        this.currentBlock.position.z += actualSpeed * this.direction;
        if (Math.abs(this.currentBlock.position.z - this.stack[this.stack.length - 1].position.z) > 13) {
            this.direction *= -1;
        }
      }
    }

    // Always animate debris and particles
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      d.mesh.position.add(d.velocity);
      d.mesh.rotation.x += d.rotVelocity.x;
      d.mesh.rotation.y += d.rotVelocity.y;
      d.mesh.rotation.z += d.rotVelocity.z;
      
      d.velocity.y -= 0.05; 

      if (d.mesh.position.y < -30) { 
        this.scene.remove(d.mesh);
        d.mesh.geometry.dispose();
        this.debris.splice(i, 1);
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= 0.05;
      p.mesh.position.add(p.velocity);
      p.mesh.rotation.x += 0.1;
      p.mesh.rotation.y += 0.1;
      (p.mesh.material as THREE.Material).opacity = p.life;
      
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        this.particles.splice(i, 1);
      }
    }

    // Always smooth camera
    if (this.stack.length > 0) {
      const currentTopY = (this.stack.length) * GAME_CONFIG.blockHeight;
      // If game is running, focus on top. If menu, just look at base.
      const targetY = this.isGameRunning ? currentTopY : GAME_CONFIG.blockHeight;
      const camTargetY = 20 + targetY;
      
      this.camera.position.y += (camTargetY - this.camera.position.y) * 0.05;
      this.camera.lookAt(0, targetY, 0);
    }

    this.animationId = requestAnimationFrame(this.animate);
  }

  private cleanup() {
    // Note: We do NOT cancel animation frame here anymore because we want the loop to persist across restarts
    // We only clear the meshes
    
    [...this.stack, ...this.debris.map(d => d.mesh), ...this.particles.map(p => p.mesh), this.currentBlock].forEach(mesh => {
      if (mesh) {
        this.scene.remove(mesh);
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) (mesh.material as THREE.Material).dispose();
      }
    });
    this.stack = [];
    this.debris = [];
    this.particles = [];
    this.currentBlock = null;
  }

  public dispose() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    this.resizeObserver.disconnect();
    this.cleanup();
    this.renderer.dispose();
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}