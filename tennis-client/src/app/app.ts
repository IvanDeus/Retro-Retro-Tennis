// app.ts
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DiscordSDK } from '@discord/embedded-app-sdk';
import { GameService } from './game.service';
import { rrtComponent } from './rrt.component';

declare global {
  interface Window {
    DISCORD_CLIENT_ID: string;
  }
}

async function waitForDiscordReady(sdk: DiscordSDK, timeout = 5000) {
    return Promise.race([
        sdk.ready(),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Discord timeout")), timeout)
        )
    ]);
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, rrtComponent],
  template: `
    <div *ngIf="!isDiscordEnv" class="discord-warning">
      <h2>⚠ Discord Required</h2>
      <p>
        This game is a <strong>Discord Activity</strong> and cannot be played
        directly in a web browser.
      </p>

      <p>
        Please launch it from Discord.
      </p>
    </div>
    <app-rrt *ngIf="isDiscordEnv"></app-rrt>
  `
})
export class App implements OnInit {
  isDiscordEnv = false;
  private gameService = inject(GameService);
  
  // 1. Declare as nullable, do NOT instantiate here
  private discordSdk: DiscordSDK | null = null;

  async ngOnInit() {
    // 2. Check if we are actually inside Discord by looking for the 'frame_id' param
    const urlParams = new URLSearchParams(window.location.search);
    const isInsideDiscord = urlParams.has('frame_id');

    if (isInsideDiscord) {
      try {
        // 3. ONLY instantiate the SDK if we are confirmed to be in Discord
        this.discordSdk = new DiscordSDK(window.DISCORD_CLIENT_ID);
        
        await waitForDiscordReady(this.discordSdk);

        this.isDiscordEnv = true;

        const auth = await this.discordSdk.commands.authorize({
            client_id: window.DISCORD_CLIENT_ID,
            response_type: 'code',
            state: '',
            prompt: 'none',
            scope: ['identify', 'guilds'],
        });

        const userResponse = await fetch(
            'https://discord.com/api/users/@me',
            {
                headers: {
                    Authorization: `Bearer ${auth.code}`
                }
            }
        );

        const userData = await userResponse.json();

        const avatarUrl = userData.avatar
            ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`
            : userData.discriminator === '0'
                ? `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(userData.id) >> 22n) % 6}.png`
                : `https://cdn.discordapp.com/embed/avatars/${Number(userData.discriminator) % 5}.png`;

        this.gameService.registerPlayerIdentity({
            id: userData.id,
            username: userData.username,
            avatar: avatarUrl
        });
      } catch (err) {
        this.isDiscordEnv = false;
        console.warn(
            "Discord SDK unavailable or failed to initialize. Blocking application startup.",
            err
        );
      }
    } else {
      // 4. Outside Discord: Safely skip SDK initialization and let the fallback UI render
      this.isDiscordEnv = false;
      console.warn("Not in Discord environment. SDK initialization skipped.");
    }
  }
}
