import { Component, OnInit, inject } from '@angular/core';
import { DiscordSDK } from '@discord/embedded-app-sdk';
import { GameService } from './game.service';
import { rrtComponent } from './rrt.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [rrtComponent],
  template: `<app-rrt></app-rrt>`
})
export class AppComponent implements OnInit {
  private gameService = inject(GameService);
  private discordSdk = new DiscordSDK(import.meta.env.VITE_DISCORD_CLIENT_ID);

  async ngOnInit() {
    await this.discordSdk.ready();
    
    // Request basic scopes to display player identities safely
    const auth = await this.discordSdk.commands.authorize({
      client_id: import.meta.env.VITE_DISCORD_CLIENT_ID,
      response_type: 'code',
      state: '',
      prompt: 'none',
      scope: ['identify', 'guilds'],
    });

    // Retrieve active profile identities out from the active embedded frame instance
    const userResponse = await fetch(`https://discord.com`, {
      headers: { Authorization: `Bearer ${auth.code}` }
    });
    const userData = await userResponse.json();

    // Construct valid Avatar Asset URLs referencing standard Discord CDN servers
    const avatarUrl = userData.avatar 
      ? `https://discordapp.com{userData.id}/${userData.avatar}.png`
      : `https://discordapp.com{Number(userData.discriminator) % 5}.png`;

    // Bind authenticated client session details to WebSocket stream instances
    this.gameService.registerPlayerIdentity(avatarUrl);
  }
}
