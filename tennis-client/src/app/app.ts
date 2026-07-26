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
    <div *ngIf="!isDiscordEnv" class="discord-warning" style="color: white;">
      <h2>⚠ Discord Required</h2>
      <p>This game is a <strong>Discord Activity</strong> and cannot be played directly in a web browser.</p>
      <p>Please launch it from Discord.</p>
     
      <p *ngIf="errorMessage" style="color: #ff4444; font-size: 0.9em; margin-top: 15px; background: rgba(255,0,0,0.1); padding: 10px; border-radius: 4px;">
        <strong>Debug Error:</strong> {{ errorMessage }}
      </p>
    </div>
    <app-rrt *ngIf="isDiscordEnv"></app-rrt>
  `
})
export class App implements OnInit {
  isDiscordEnv = false;
  errorMessage: string = '';
  private gameService = inject(GameService);
  private discordSdk: DiscordSDK | null = null;

  async ngOnInit() {
    console.log("🚀 App ngOnInit started");
    
    const urlParams = new URLSearchParams(window.location.search);
    const isInsideDiscord = urlParams.has('frame_id');
    
    console.log("🔍 Is inside Discord (has frame_id)?", isInsideDiscord);
    console.log("🔍 window.DISCORD_CLIENT_ID:", window.DISCORD_CLIENT_ID);

    if (isInsideDiscord) {
      if (!window.DISCORD_CLIENT_ID) {
        this.errorMessage = "window.DISCORD_CLIENT_ID is undefined!";
        console.error("❌", this.errorMessage);
        return;
      }

      try {
        console.log("⏳ Initializing Discord SDK...");
        this.discordSdk = new DiscordSDK(window.DISCORD_CLIENT_ID);
        
        console.log("⏳ Waiting for Discord SDK to be ready...");
        await waitForDiscordReady(this.discordSdk);
        console.log("✅ Discord SDK is ready!");

        this.isDiscordEnv = true;

        console.log("⏳ Authorizing with Discord...");
        const auth = await this.discordSdk.commands.authorize({
            client_id: window.DISCORD_CLIENT_ID,
            response_type: 'code',
            state: '',
            prompt: 'none',
            scope: ['identify', 'guilds'],
        });
        console.log("✅ Authorized successfully, received code");

        // 1. Exchange the code for an access token via our backend
        console.log("⏳ Exchanging code for access token...");
        const tokenResponse = await fetch('/api/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: auth.code })
        });

        if (!tokenResponse.ok) {
            const errText = await tokenResponse.text();
            throw new Error(`Failed to exchange code: ${tokenResponse.status} - ${errText}`);
        }

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        // 2. Use the real access_token to fetch user data
        console.log("⏳ Fetching user data...");
        const userResponse = await fetch('https://discord.com/api/users/@me', {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });

        if (!userResponse.ok) {
            throw new Error(`Failed to fetch user: ${userResponse.status} ${userResponse.statusText}`);
        }

        const userData = await userResponse.json();
        console.log("✅ User data fetched:", userData.username);

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
        console.log("✅ Player identity registered successfully. Game starting!");

      } catch (err) {
        this.isDiscordEnv = false;
        this.errorMessage = err instanceof Error ? err.message : String(err);
        console.error("❌ Discord SDK initialization or authorization failed:", err);
      }
    } else {
      this.isDiscordEnv = false;
      this.errorMessage = "Missing 'frame_id' in URL. Not running inside Discord.";
      console.warn("⚠️ Not in Discord environment. SDK initialization skipped.");
    }
  }
}
