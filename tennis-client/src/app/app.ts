import { Component, OnInit } from '@angular/core';
import { DiscordSDK } from '@discord/embedded-app-sdk';

@Component({
  selector: 'app-root',
  template: `<app-rrt></app-rrt>`
})
export class AppComponent implements OnInit {
  private discordSdk = new DiscordSDK(import.meta.env.VITE_DISCORD_CLIENT_ID);

  async ngOnInit() {
    // Must authenticate within the Discord Activity Frame environment
    await this.discordSdk.ready();
    await this.discordSdk.commands.authorize({
      client_id: import.meta.env.VITE_DISCORD_CLIENT_ID,
      response_type: 'code',
      state: '',
      prompt: 'none',
      scope: ['identify', 'guilds'],
    });
  }
}
