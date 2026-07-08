import { Component, ElementRef, ViewChild, HostListener, effect, inject, OnInit } from '@angular/core';
import { GameService } from './game.service';
import { StatsService } from './stats.service';

@Component({
  selector: 'app-rrt',
  standalone: true,
  template: `
    <div class="game-container">
      <!-- Historical Performance Ledger Banner Display -->
      <div class="stats-banner">
        <span>🏆 Wins: {{ statsService.stats().matchesWon }}</span>
        <span>💀 Losses: {{ statsService.stats().matchesLost }}</span>
      </div>

      <div class="canvas-wrapper">
        <canvas #gameCanvas width="340" height="600"></canvas>

        <!-- Match Over Visual Overlay Card View -->
        @if (gameService.gameState()?.winner) {
          <div class="overlay-card">
            <h2>{{ gameService.playerSide() === gameService.gameState().winner ? 'VICTORY' : 'DEFEAT' }}</h2>
            <p>Score Matrix finalized at 21 Points</p>
            <button (click)="onRematchClick()">Play Again</button>
          </div>
        }
      </div>
    </div>
  `
})
export class rrtComponent implements OnInit {
  @ViewChild('gameCanvas', { static: true }) canvas!: ElementRef<HTMLCanvasElement>;
  private ctx!: CanvasRenderingContext2D;
  
  protected gameService = inject(GameService);
  protected statsService = inject(StatsService);
  private imageCache: { [url: string]: HTMLImageElement } = {};

  private isDragging = false;
  private lastTouchX = 0;
  private currentPaddleX = 170;

  constructor() {
    effect(() => {
      const state = this.gameService.gameState();
      if (state) this.drawGame(state);
    });
  }

  ngOnInit() {
    this.ctx = this.canvas.nativeElement.getContext('2d')!;
  }

  @HostListener('mousedown', ['$event'])
  onMouseDown(event: MouseEvent) {
    if (this.gameService.gameState()?.winner) return; // Freeze actions if match is finalized
    this.isDragging = true;
    this.lastTouchX = event.clientX;
  }

  @HostListener('mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    if (!this.isDragging) return;
    const deltaX = event.clientX - this.lastTouchX;
    this.lastTouchX = event.clientX;
    this.processMoveDelta(deltaX);
  }

  @HostListener('window:mouseup') onMouseUp() { this.isDragging = false; }

  @HostListener('touchstart', ['$event'])
  onTouchStart(event: TouchEvent) {
    if (event.touches.length === 0 || this.gameService.gameState()?.winner) return;
    this.isDragging = true;
    this.lastTouchX = event.touches.clientX;
    if (event.cancelable) event.preventDefault(); 
  }

  @HostListener('touchmove', ['$event'])
  onTouchMove(event: TouchEvent) {
    if (!this.isDragging || event.touches.length === 0) return;
    const deltaX = event.touches.clientX - this.lastTouchX;
    this.lastTouchX = event.touches.clientX;
    this.processMoveDelta(deltaX);
    if (event.cancelable) event.preventDefault();
  }

  @HostListener('touchend') @HostListener('touchcancel') onTouchEnd() { this.isDragging = false; }

  private processMoveDelta(deltaX: number) {
    const side = this.gameService.playerSide();
    const directionalDelta = (side === 'p2') ? -deltaX : deltaX;

    this.currentPaddleX += directionalDelta;
    this.currentPaddleX = Math.max(40, Math.min(300, this.currentPaddleX));
    this.gameService.updatePaddle(this.currentPaddleX);
  }

  protected onRematchClick(): void {
    this.gameService.requestRematch();
  }

  private getCachedImage(url: string): HTMLImageElement | null {
    if (!url) return null;
    if (this.imageCache[url]) return this.imageCache[url];
    const img = new Image();
    img.src = url;
    this.imageCache[url] = img;
    return img;
  }

  private drawGame(state: any) {
    this.ctx.clearRect(0, 0, 340, 600);
    
    // Middle Boundary Net line
    this.ctx.strokeStyle = '#222222';
    this.ctx.lineWidth = 4;
    this.ctx.beginPath();
    this.ctx.moveTo(0, 300);
    this.ctx.lineTo(340, 300);
    this.ctx.stroke();

    const side = this.gameService.playerSide();
    const isP2 = side === 'p2';

    const rawLocal = isP2 ? state.players.p2 : state.players.p1;
    const rawRemote = isP2 ? state.players.p1 : state.players.p2;

    if (rawLocal && !this.isDragging) {
      this.currentPaddleX = rawLocal.x;
    }

    const localX = rawLocal ? (isP2 ? 340 - rawLocal.x : rawLocal.x) : 170;
    const remoteX = rawRemote ? (isP2 ? 340 - rawRemote.x : rawRemote.x) : 170;
    const ballX = isP2 ? 340 - state.ball.x : state.ball.x;
    const ballY = isP2 ? 600 - state.ball.y : state.ball.y;

    // Render Dynamic Scores
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    this.ctx.font = 'bold 54px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    const localScore = isP2 ? state.score.p2 : state.score.p1;
    const remoteScore = isP2 ? state.score.p1 : state.score.p2;

    this.ctx.fillText(remoteScore.toString(), 170, 180);
    this.ctx.fillText(localScore.toString(), 170, 420);

    this.ctx.fillStyle = '#FFFFFF';

    // Draw Local (Bottom)
    if (rawLocal) {
      this.ctx.fillRect(localX - 40, 570, 80, 15);
      const imgLocal = this.getCachedImage(rawLocal.avatarUrl);
      if (imgLocal?.complete) this.ctx.drawImage(imgLocal, localX - 15, 530, 30, 30);
    }

    // Draw Remote (Top)
    if (rawRemote) {
      this.ctx.fillRect(remoteX - 40, 15, 80, 15);
      const imgRemote = this.getCachedImage(rawRemote.avatarUrl);
      if (imgRemote?.complete) this.ctx.drawImage(imgRemote, remoteX - 15, 40, 30, 30);
    }

    // Only render the active ball if no one has won yet
    if (!state.winner) {
      this.ctx.beginPath();
      this.ctx.arc(ballX, ballY, 8, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }
}
