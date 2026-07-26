// server.js
require('dotenv').config();
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const PORT = parseInt(process.env.PORT) || 3001;
const path = require('path');
const fs = require('fs'); // <-- 1. Added fs module to read the file

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

let players = {}; 
let score = { p1: 0, p2: 0 };
let ball = { x: 170, y: 300, vx: 3, vy: 4 };
let winner = null; // Tracks 'p1' or 'p2' when a match finishes

function resetBall() {
  ball = { x: 170, y: 300, vx: (Math.random() > 0.5 ? 3 : -3), vy: (Math.random() > 0.5 ? 4 : -4) };
}

setInterval(() => {
  // Only execute game loop movement if there are 2 players and no one has won yet
  if (Object.keys(players).length === 2 && !winner) {
    ball.x += ball.vx;
    ball.y += ball.vy;

    if (ball.x <= 8 || ball.x >= 332) ball.vx *= -1;

    // --- Top Boundary (Player 1) ---
    if (ball.y <= 30) {
      if (players.p1 && ball.x >= players.p1.x - 40 && ball.x <= players.p1.x + 40) {
        ball.vy = Math.abs(ball.vy);
      } else if (ball.y <= 0) {
        score.p2 += 1;
        if (score.p2 >= 21) winner = 'p2';
        resetBall();
      }
    }

    // --- Bottom Boundary (Player 2) ---
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

// GET ONLY favicon & css & js from www/
const STATIC_FILES = [
  { pattern: "/favicon.ico", path: "./www/favicon.ico", mime: "image/x-icon" },
  { pattern: "/", path: "./www/index.html", mime: "text/html; charset=utf-8" },
  { pattern: "/index.html", path: "./www/index.html", mime: "text/html; charset=utf-8" },
];

function getStaticFileConfig(pathname) {
  const exact = STATIC_FILES.find(item => item.pattern === pathname);
  if (exact) return exact;
  if (pathname.endsWith(".css")) {
    return { path: `./www${pathname}`, mime: "text/css; charset=utf-8" };
  }
  if (pathname.endsWith(".js")) {
    return { path: `./www${pathname}`, mime: "application/javascript; charset=utf-8" };
  }
  return null;
}

// <-- 2. Helper function to serve index.html with injected DISCORD_CLIENT_ID
function serveInjectedIndex(res) {
  const filePath = path.join(__dirname, 'www', 'index.html');
  let html = fs.readFileSync(filePath, 'utf8');
  
  const clientId = process.env.DISCORD_CLIENT_ID || 'YOUR_CLIENT_ID';
  
  // Option A: Replace the placeholder if you added it to index.html
  if (html.includes('YOUR_DISCORD_CLIENT_ID_HERE')) {
    html = html.replace('YOUR_DISCORD_CLIENT_ID_HERE', clientId);
  } 
  // Option B: Fallback injection right before </head> if placeholder is missing
  else if (!html.includes('window.DISCORD_CLIENT_ID')) {
    const scriptTag = `<script>\n    window.DISCORD_CLIENT_ID = "${clientId}";\n  </script>`;
    html = html.replace('</head>', `${scriptTag}\n  </head>`);
  }
  
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}

// <-- 3. Updated route handler to use the helper
app.get(/.*/, (req, res, next) => {
  const config = getStaticFileConfig(req.path);
  if (config) {
    if (config.path.includes('index.html')) {
      return serveInjectedIndex(res); // Inject for direct / or /index.html requests
    }
    res.setHeader('Content-Type', config.mime);
    return res.sendFile(path.join(__dirname, config.path));
  }
  
  // Fallback for Angular routing (e.g., if user refreshes on /some-route)
  serveInjectedIndex(res);
});

httpServer.listen(PORT, () => {
  console.log(`Discord Tennis Game Activity Server is ON! Port:${PORT}`);
});
