import { Injectable, signal, inject } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { StatsService } from './stats.service';

@Injectable({ providedIn: 'root' })
export class GameService {
  private socket!: Socket;
  private statsService = inject(StatsService);

  public playerSide = signal<string>('');
  public gameState = signal<any>(null);
  
  private processedMatchWinner: string | null = null;

  constructor() {
    this.socket = io('http://localhost:3000'); 
    
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
      this.processedMatchWinner = null; // Reset lock tracker upon rematch initialization
    }
  }

  public registerPlayerIdentity(avatarUrl: string): void {
    this.socket.emit('joinGame', { avatarUrl });
  }

  public updatePaddle(x: number): void {
    this.socket.emit('movePaddle', x);
  }

  public requestRematch(): void {
    this.socket.emit('rematch');
  }
}
