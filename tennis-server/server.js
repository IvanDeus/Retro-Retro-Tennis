// server.js
require('dotenv').config();
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const PORT = parseInt(process.env.PORT) || 3001;
const path = require('path');
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
  
  players[playerIndex] = { id: socket.id, x: 170, avatarUrl: '' };
  socket.emit('init', playerIndex);

  socket.on('joinGame', (data) => {
    if (players[playerIndex]) players[playerIndex].avatarUrl = data.avatarUrl;
  });

  socket.on('movePaddle', (x) => {
    if (players[playerIndex] && !winner) players[playerIndex].x = x;
  });

  // Allows clients to trigger a new match session manually after a win
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
// 1. Whitelist middleware (only allow safe files)
const staticWhitelist = (req, res, next) => {
  const ext = path.extname(req.path).toLowerCase();
  const basename = path.basename(req.path).toLowerCase();

  const allowedExtensions = ['.js', '.css', '.ico', '.html'];
  const allowedFiles = ['index.html', 'favicon.ico'];

  if (allowedFiles.includes(basename) || allowedExtensions.includes(ext)) {
    return next();
  }
  return res.status(404).send('Not Found');
};
// 2. Serve static files (this must come BEFORE any catch-all)
app.use(staticWhitelist, express.static('./www'));
// 3. Fallback to index.html for SPA / clean URLs (this must come AFTER static)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'www', 'index.html'));
});

console.log("Discord Tennis Game Activity Server is ON! Port :", PORT);
httpServer.listen(PORT);
