// app.ts
import { Component, OnInit, inject } from '@angular/core';
import { DiscordSDK } from '@discord/embedded-app-sdk';
import { GameService } from './game.service';
import { rrtComponent } from './rrt.component';

declare global {
  interface Window {
    DISCORD_CLIENT_ID: string;
  }
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [rrtComponent],
  template: `<app-rrt></app-rrt>`
})
export class App implements OnInit {
  private gameService = inject(GameService);
  private discordSdk = new DiscordSDK(window.DISCORD_CLIENT_ID);

  async ngOnInit() {
    await this.discordSdk.ready();
    
    // Request basic scopes to display player identities safely
    const auth = await this.discordSdk.commands.authorize({
      client_id: window.DISCORD_CLIENT_ID,
      response_type: 'code',
      state: '',
      prompt: 'none',
      scope: ['identify', 'guilds'],
    });

    // Retrieve active profile 
    const userResponse = await fetch(`https://discord.com/api/users/@me`, {headers: { Authorization: `Bearer ${auth.code}`}});
    const userData = await userResponse.json();
   // Construct valid Avatar Asset URLs 
   const avatarUrl = userData.avatar ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`
    : userData.discriminator === '0' 
    ? `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(userData.id) >> 22n) % 6}.png`
    : `https://cdn.discordapp.com/embed/avatars/${Number(userData.discriminator) % 5}.png`; 
    // Bind authenticated client session details to WebSocket stream instances
    this.gameService.registerPlayerIdentity(avatarUrl);
  }
}
