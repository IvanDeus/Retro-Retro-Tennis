// server.js
require('dotenv').config();
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const PORT = parseInt(process.env.PORT) || 3001;
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

let players = {}; 
let score = { p1: 0, p2: 0 };
let ball = { x: 170, y: 300, vx: 3, vy: 4 };
let winner = null;

function resetBall() {
  ball = { x: 170, y: 300, vx: (Math.random() > 0.5 ? 3 : -3), vy: (Math.random() > 0.5 ? 4 : -4) };
}

setInterval(() => {
  if (Object.keys(players).length === 2 && !winner) {
    ball.x += ball.vx;
    ball.y += ball.vy;

    if (ball.x <= 8 || ball.x >= 332) ball.vx *= -1;

    if (ball.y <= 30) {
      if (players.p1 && ball.x >= players.p1.x - 40 && ball.x <= players.p1.x + 40) {
        ball.vy = Math.abs(ball.vy);
      } else if (ball.y <= 0) {
        score.p2 += 1;
        if (score.p2 >= 21) winner = 'p2';
        resetBall();
      }
    }

    if (ball.y >= 570) {
      if (players.p2 && ball.x >= players.p2.x - 40 && ball.x <= players.p2.x + 40) {
        ball.vy = -Math.abs(ball.vy);
      } else if (ball.y >= 600) {
        score.p1 += 1;
        if (score.p1 >= 21) winner = 'p1';
        resetBall();
      }
    }

    io.emit('gameState', { ball, players, score, winner });
  }
}, 1000 / 60);

io.on('connection', (socket) => {
  if (Object.keys(players).length >= 2) return socket.disconnect();
  const playerIndex = !players['p1'] ? 'p1' : 'p2';
  
  players[playerIndex] = { id: socket.id, discordId: '', username: '', x: 170, avatarUrl: '' };
  socket.emit('init', playerIndex);

  socket.on('joinGame', (playerData) => {
    if (players[playerIndex]) {
      players[playerIndex].discordId = playerData.id;
      players[playerIndex].username = playerData.username;
      players[playerIndex].avatarUrl = playerData.avatar;
    }
  });

  socket.on('movePaddle', (x) => {
    if (players[playerIndex] && !winner) players[playerIndex].x = x;
  });

  socket.on('rematch', () => {
    if (winner) {
      score = { p1: 0, p2: 0 };
      winner = null;
      resetBall();
      io.emit('gameState', { ball, players, score, winner });
    }
  });

  socket.on('disconnect', () => {
    delete players[playerIndex];
    score = { p1: 0, p2: 0 };
    winner = null;
  });
});

// <-- 2. ADD THIS NEW ENDPOINT: Exchanges the auth code for an access token
app.post('/api/token', async (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ error: 'Authorization code is required' });
  }

  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    client_secret: process.env.DISCORD_CLIENT_SECRET,
    grant_type: 'authorization_code',
    code: code,
  });

  try {
    const response = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });

    const data = await response.json();

    if (data.access_token) {
      res.json({ access_token: data.access_token });
    } else {
      console.error('Discord token exchange failed:', data);
      res.status(500).json({ error: 'Failed to exchange code for token', details: data });
    }
  } catch (error) {
    console.error('Error exchanging code:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const STATIC_FILES = [
  { pattern: "/favicon.ico", path: "./www/favicon.ico", mime: "image/x-icon" },
  { pattern: "/", path: "./www/index.html", mime: "text/html; charset=utf-8" },
  { pattern: "/index.html", path: "./www/index.html", mime: "text/html; charset=utf-8" },
];

function getStaticFileConfig(pathname) {
  const exact = STATIC_FILES.find(item => item.pattern === pathname);
  if (exact) return exact;
  if (pathname.endsWith(".css")) return { path: `./www${pathname}`, mime: "text/css; charset=utf-8" };
  if (pathname.endsWith(".js")) return { path: `./www${pathname}`, mime: "application/javascript; charset=utf-8" };
  return null;
}

function serveInjectedIndex(res) {
  const filePath = path.join(__dirname, 'www', 'index.html');
  let html = fs.readFileSync(filePath, 'utf8');
  const clientId = process.env.DISCORD_CLIENT_ID || 'YOUR_CLIENT_ID';
  
  if (html.includes('YOUR_DISCORD_CLIENT_ID_HERE')) {
    html = html.replace('YOUR_DISCORD_CLIENT_ID_HERE', clientId);
  } else if (!html.includes('window.DISCORD_CLIENT_ID')) {
    const scriptTag = `<script>\n    window.DISCORD_CLIENT_ID = "${clientId}";\n  </script>`;
    html = html.replace('</head>', `${scriptTag}\n  </head>`);
  }
  
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}

app.get(/.*/, (req, res, next) => {
  const config = getStaticFileConfig(req.path);
  if (config) {
    if (config.path.includes('index.html')) return serveInjectedIndex(res);
    res.setHeader('Content-Type', config.mime);
    return res.sendFile(path.join(__dirname, config.path));
  }
  serveInjectedIndex(res);
});

httpServer.listen(PORT, () => {
  console.log(`Discord Tennis Game Activity Server is ON! Port:${PORT}`);
});
