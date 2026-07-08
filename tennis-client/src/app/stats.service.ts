import { Injectable, signal } from '@angular/core';

export interface PlayerStats {
  matchesWon: number;
  matchesLost: number;
}

@Injectable({ providedIn: 'root' })
export class StatsService {
  // Signal providing reactive access to overall historical data records
  public stats = signal<PlayerStats>({ matchesWon: 0, matchesLost: 0 });

  constructor() {
    this.loadStats();
  }

  private loadStats(): void {
    const raw = localStorage.getItem('discord_rrt_stats');
    if (raw) {
      try {
        this.stats.set(JSON.parse(raw));
      } catch (e) {
        console.error('Error parsing historical data structures', e);
      }
    }
  }

  public recordMatchResult(isWinner: boolean): void {
    this.stats.update(current => {
      const updated = {
        matchesWon: current.matchesWon + (isWinner ? 1 : 0),
        matchesLost: current.matchesLost + (isWinner ? 0 : 1)
      };
      localStorage.setItem('discord_rrt_stats', JSON.stringify(updated));
      return updated;
    });
  }
}
