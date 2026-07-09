// game.service.ts
import { Injectable, signal, inject } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { StatsService } from './stats.service';
// 1. Define the interface to match the object passed from app.ts
export interface PlayerIdentity {
  id: string;
  username: string;
  avatar: string;
}

@Injectable({ providedIn: 'root' })
export class GameService {
  private socket!: Socket;
  private statsService = inject(StatsService);

  public playerSide = signal<string>('');
  public gameState = signal<any>(null);
  
  private processedMatchWinner: string | null = null;

  constructor() {
    this.socket = io('/'); 
    
    this.socket.on('init', (side: string) => this.playerSide.set(side));
    
    this.socket.on('gameState', (state: any) => {
      this.gameState.set(state);
      this.evaluateWinCondition(state);
    });
  }

  private evaluateWinCondition(state: any): void {
    if (state.winner && this.processedMatchWinner !== state.winner) {
      this.processedMatchWinner = state.winner;
      const isLocalUserWinner = this.playerSide() === state.winner;
      this.statsService.recordMatchResult(isLocalUserWinner);
    } else if (!state.winner) {
      this.processedMatchWinner = null; 
    }
  }
  // 2. Update the method signature to accept the PlayerIdentity object
  public registerPlayerIdentity(player: PlayerIdentity): void {
    // 3. Emit the entire player object to the server
    this.socket.emit('joinGame', player);
  }

  public updatePaddle(x: number): void {
    this.socket.emit('movePaddle', x);
  }

  public requestRematch(): void {
    this.socket.emit('rematch');
  }
}
