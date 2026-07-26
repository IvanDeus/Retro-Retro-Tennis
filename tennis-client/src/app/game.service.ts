// game.service.ts
import { Injectable, signal, inject, computed } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { StatsService } from './stats.service';

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
  
  // NEW: Automatically calculates if we are waiting based on the game state
  public isWaiting = computed(() => {
    const state = this.gameState();
    // If state is null, or players object is missing, we are waiting
    if (!state || !state.players) return true;
    
    // Check if either player slot is missing or lacks an ID (hasn't joined yet)
    const p1Missing = !state.players.p1 || !state.players.p1.id;
    const p2Missing = !state.players.p2 || !state.players.p2.id;
    
    return p1Missing || p2Missing;
  });
  
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

  public registerPlayerIdentity(player: PlayerIdentity): void {
    this.socket.emit('joinGame', player);
  }

  public updatePaddle(x: number): void {
    // NEW: Prevent sending paddle moves to server while waiting for opponent
    if (this.isWaiting()) return; 
    this.socket.emit('movePaddle', x);
  }

  public requestRematch(): void {
    this.socket.emit('rematch');
  }
}
