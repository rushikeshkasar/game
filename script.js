// DOM Element References
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const pageViews = document.querySelectorAll(".page-view");
const navLinks = document.querySelectorAll(".nav-link[data-route]");
const routeTriggers = document.querySelectorAll("[data-route]");
const gotoTriggers = document.querySelectorAll("[data-goto]");

const menuBestScore = document.getElementById("menuBestScore");
const menuSavedCount = document.getElementById("menuSavedCount");
const difficultyButtons = document.querySelectorAll("[data-difficulty]");
const wallModeButtons = document.querySelectorAll("[data-wall-mode]");
const arenaModeLabel = document.getElementById("arenaModeLabel");

const homePlayBtn = document.getElementById("homePlayBtn");
const homeLeaderboardBtn = document.getElementById("homeLeaderboardBtn");
const homeHowToBtn = document.getElementById("homeHowToBtn");
const backToMenuBtn = document.getElementById("backToMenuBtn");
const pauseMenuBtn = document.getElementById("pauseMenuBtn");
const gameOverLeaderboardBtn = document.getElementById("gameOverLeaderboardBtn");

const scoreDisplay = document.getElementById("scoreDisplay");
const highScoreDisplay = document.getElementById("highScoreDisplay");
const finalScoreDisplay = document.getElementById("finalScoreDisplay");
const bestScoreDisplay = document.getElementById("bestScoreDisplay");

const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const restartBtn = document.getElementById("restartBtn");
const headerPlayBtn = document.getElementById("headerPlayBtn");

const startOverlay = document.getElementById("startOverlay");
const pauseOverlay = document.getElementById("pauseOverlay");
const gameOverOverlay = document.getElementById("gameOverOverlay");

const overlayStartBtn = document.getElementById("overlayStartBtn");
const overlayResumeBtn = document.getElementById("overlayResumeBtn");
const playAgainBtn = document.getElementById("playAgainBtn");

const btnUp = document.getElementById("btnUp");
const btnDown = document.getElementById("btnDown");
const btnLeft = document.getElementById("btnLeft");
const btnRight = document.getElementById("btnRight");

const saveScoreForm = document.getElementById("saveScoreForm");
const playerNameInput = document.getElementById("playerNameInput");
const saveScoreBtn = document.getElementById("saveScoreBtn");
const saveFeedback = document.getElementById("saveFeedback");

const filterButtons = document.querySelectorAll(".filter-btn[data-filter]");
const leaderboardEmpty = document.getElementById("leaderboardEmpty");
const leaderboardTableWrap = document.getElementById("leaderboardTableWrap");
const leaderboardBody = document.getElementById("leaderboardBody");
const clearLeaderboardBtn = document.getElementById("clearLeaderboardBtn");

// Grid & Difficulty Constants
const GRID_SIZE = 20;
const TILE_SIZE = canvas.width / GRID_SIZE;
const DIFFICULTY_SPEEDS = {
  Easy: { base: 185, min: 95, step: 3 },
  Normal: { base: 150, min: 70, step: 4 },
  Hard: { base: 115, min: 55, step: 5 },
};

const VALID_PAGES = ["home", "play", "leaderboard", "how-to-play", "about"];
const HIGH_SCORE_STORAGE_KEY = "snakeGameHighScore";
const LEADERBOARD_STORAGE_KEY = "snakeGameLeaderboard";
const PLAYER_NAME_STORAGE_KEY = "snakeGameLastPlayer";
const MAX_LEADERBOARD_ENTRIES = 10;

// Game & Page State Variables
let currentPage = "home";
let selectedDifficulty = "Normal";
let selectedWallMode = "Solid"; // "Solid" | "Wrap"
let activeFilter = "All";

let snake = [];
let food = { x: 0, y: 0 };
let direction = { x: 1, y: 0 };
let directionQueue = [];
let score = 0;
let highScore = 0;
let leaderboard = [];
let scoreSavedThisRound = false;
let clearConfirmTimer = null;
let gameStatus = "READY"; // READY | PLAYING | PAUSED | GAME_OVER
let gameTimer = null;

// Switch visible page view and sync URL hash + navigation state
function navigateTo(pageName, updateHash = true) {
  const targetPage = VALID_PAGES.includes(pageName) ? pageName : "home";

  // Automatically pause if leaving the active game arena mid-round
  if (currentPage === "play" && targetPage !== "play" && gameStatus === "PLAYING") {
    gameStatus = "PAUSED";
    clearTimeout(gameTimer);
    updateUIState();
  }

  currentPage = targetPage;

  pageViews.forEach((section) => {
    const isMatch = section.dataset.page === targetPage;
    section.hidden = !isMatch;
    section.classList.toggle("page-active", isMatch);
  });

  navLinks.forEach((link) => {
    const isMatch = link.dataset.route === targetPage;
    link.classList.toggle("active", isMatch);
    if (isMatch) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });

  if (updateHash && window.location.hash !== `#${targetPage}`) {
    window.location.hash = `#${targetPage}`;
  }

  window.scrollTo(0, 0);
}

// Update menu stats and mode indicator labels
function updateModeDisplays() {
  const wallLabel = selectedWallMode === "Solid" ? "Solid Walls" : "Wrap-Around";
  arenaModeLabel.textContent = `${selectedDifficulty} · ${wallLabel}`;
  menuBestScore.textContent = String(highScore);
  menuSavedCount.textContent = String(leaderboard.length);
}

// Load saved high score from localStorage
function loadHighScore() {
  const saved = localStorage.getItem(HIGH_SCORE_STORAGE_KEY);
  highScore = saved ? parseInt(saved, 10) || 0 : 0;
  highScoreDisplay.textContent = String(highScore);
  updateModeDisplays();
}

// Save updated high score to localStorage
function saveHighScore(newScore) {
  if (newScore > highScore) {
    highScore = newScore;
    localStorage.setItem(HIGH_SCORE_STORAGE_KEY, String(highScore));
    highScoreDisplay.textContent = String(highScore);
    updateModeDisplays();
  }
}

// Load leaderboard entries from localStorage
function loadLeaderboard() {
  try {
    const raw = localStorage.getItem(LEADERBOARD_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    leaderboard = Array.isArray(parsed) ? parsed : [];
  } catch {
    leaderboard = [];
  }
  renderLeaderboard();
  updateModeDisplays();
}

// Persist leaderboard entries to localStorage
function saveLeaderboard() {
  localStorage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(leaderboard));
  updateModeDisplays();
}

// Add a new score entry, keep top 10 sorted descending
function addLeaderboardEntry(playerName, playerScore) {
  const cleanName = playerName.trim() || "Player";
  const today = new Date().toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  leaderboard.push({
    name: cleanName,
    score: playerScore,
    difficulty: selectedDifficulty,
    wallMode: selectedWallMode,
    date: today,
  });

  leaderboard.sort((a, b) => b.score - a.score);
  leaderboard = leaderboard.slice(0, MAX_LEADERBOARD_ENTRIES);

  localStorage.setItem(PLAYER_NAME_STORAGE_KEY, cleanName);
  saveLeaderboard();
  renderLeaderboard();
}

// Render leaderboard rows filtered by selected difficulty
function renderLeaderboard() {
  leaderboardBody.innerHTML = "";

  const filteredEntries =
    activeFilter === "All"
      ? leaderboard
      : leaderboard.filter((entry) => (entry.difficulty || "Normal") === activeFilter);

  clearLeaderboardBtn.disabled = leaderboard.length === 0;

  if (filteredEntries.length === 0) {
    leaderboardEmpty.textContent =
      leaderboard.length === 0
        ? "No scores saved yet. Finish a game and save your score to appear on the board."
        : `No saved scores for ${activeFilter} difficulty yet.`;
    leaderboardEmpty.classList.remove("hidden");
    leaderboardTableWrap.classList.add("hidden");
    return;
  }

  leaderboardEmpty.classList.add("hidden");
  leaderboardTableWrap.classList.remove("hidden");

  filteredEntries.forEach((entry, index) => {
    const row = document.createElement("tr");

    const rankCell = document.createElement("td");
    rankCell.className = index === 0 ? "col-rank rank-top" : "col-rank";
    rankCell.textContent = `#${index + 1}`;

    const nameCell = document.createElement("td");
    nameCell.textContent = entry.name;

    const modeCell = document.createElement("td");
    modeCell.className = "col-mode";
    const diffText = entry.difficulty || "Normal";
    const wallText = entry.wallMode === "Wrap" ? "Wrap" : "Solid";
    modeCell.textContent = `${diffText} · ${wallText}`;

    const scoreCell = document.createElement("td");
    scoreCell.className = "col-score";
    scoreCell.textContent = String(entry.score);

    const dateCell = document.createElement("td");
    dateCell.className = "col-date";
    dateCell.textContent = entry.date || "";

    row.appendChild(rankCell);
    row.appendChild(nameCell);
    row.appendChild(modeCell);
    row.appendChild(scoreCell);
    row.appendChild(dateCell);
    leaderboardBody.appendChild(row);
  });
}

// Reset snake, score, and direction to initial state
function resetGameState() {
  snake = [
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 },
  ];
  direction = { x: 1, y: 0 };
  directionQueue = [];
  score = 0;
  scoreDisplay.textContent = "0";
  spawnFood();
}

// Generate food at a random grid cell not occupied by the snake
function spawnFood() {
  const emptyCells = [];

  for (let x = 0; x < GRID_SIZE; x++) {
    for (let y = 0; y < GRID_SIZE; y++) {
      const isOccupied = snake.some(
        (segment) => segment.x === x && segment.y === y
      );
      if (!isOccupied) {
        emptyCells.push({ x, y });
      }
    }
  }

  if (emptyCells.length === 0) {
    handleGameOver();
    return;
  }

  const randomIndex = Math.floor(Math.random() * emptyCells.length);
  food = emptyCells[randomIndex];
}

// Calculate current step delay based on difficulty and score
function getCurrentSpeed() {
  const config = DIFFICULTY_SPEEDS[selectedDifficulty] || DIFFICULTY_SPEEDS.Normal;
  const level = Math.floor(score / 10);
  return Math.max(config.min, config.base - level * config.step);
}

// Manage visible canvas overlays and button states
function updateUIState() {
  startOverlay.classList.toggle("hidden", gameStatus !== "READY");
  startOverlay.setAttribute("aria-hidden", String(gameStatus !== "READY"));

  pauseOverlay.classList.toggle("hidden", gameStatus !== "PAUSED");
  pauseOverlay.setAttribute("aria-hidden", String(gameStatus !== "PAUSED"));

  gameOverOverlay.classList.toggle("hidden", gameStatus !== "GAME_OVER");
  gameOverOverlay.setAttribute("aria-hidden", String(gameStatus !== "GAME_OVER"));

  if (gameStatus === "PLAYING") {
    startBtn.disabled = true;
    pauseBtn.disabled = false;
    pauseBtn.textContent = "Pause";
  } else if (gameStatus === "PAUSED") {
    startBtn.disabled = true;
    pauseBtn.disabled = false;
    pauseBtn.textContent = "Resume";
  } else {
    startBtn.disabled = false;
    pauseBtn.disabled = true;
    pauseBtn.textContent = "Pause";
  }
}

// Schedule the next game loop tick
function scheduleNextTick() {
  clearTimeout(gameTimer);
  if (gameStatus !== "PLAYING") return;

  gameTimer = setTimeout(() => {
    updateGame();
    drawGame();
    if (gameStatus === "PLAYING") {
      scheduleNextTick();
    }
  }, getCurrentSpeed());
}

// Start a fresh game session
function startGame() {
  if (gameStatus === "PLAYING") return;

  if (gameStatus === "GAME_OVER" || gameStatus === "READY") {
    resetGameState();
  }

  gameStatus = "PLAYING";
  updateUIState();
  drawGame();
  scheduleNextTick();
}

// Pause or resume an active game
function togglePause() {
  if (gameStatus === "PLAYING") {
    gameStatus = "PAUSED";
    clearTimeout(gameTimer);
    updateUIState();
  } else if (gameStatus === "PAUSED") {
    gameStatus = "PLAYING";
    updateUIState();
    scheduleNextTick();
  }
}

// Immediately restart the game from scratch
function restartGame() {
  clearTimeout(gameTimer);
  resetGameState();
  gameStatus = "PLAYING";
  updateUIState();
  drawGame();
  scheduleNextTick();
}

// End the game and display the Game Over screen
function handleGameOver() {
  clearTimeout(gameTimer);
  gameStatus = "GAME_OVER";
  scoreSavedThisRound = false;
  saveHighScore(score);

  finalScoreDisplay.textContent = String(score);
  bestScoreDisplay.textContent = String(highScore);

  const lastPlayer = localStorage.getItem(PLAYER_NAME_STORAGE_KEY) || "";
  playerNameInput.value = lastPlayer;
  saveFeedback.textContent = "";

  if (score > 0) {
    saveScoreForm.classList.remove("hidden");
    saveScoreBtn.disabled = false;
    playerNameInput.disabled = false;
  } else {
    saveScoreForm.classList.add("hidden");
  }

  updateUIState();
}

// Queue a direction change while preventing immediate 180-degree reversal
function changeDirection(newX, newY) {
  if (currentPage !== "play" || gameStatus !== "PLAYING") return;

  const referenceDir =
    directionQueue.length > 0
      ? directionQueue[directionQueue.length - 1]
      : direction;

  const isOpposite = referenceDir.x + newX === 0 && referenceDir.y + newY === 0;
  const isSame = referenceDir.x === newX && referenceDir.y === newY;

  if (!isOpposite && !isSame && directionQueue.length < 2) {
    directionQueue.push({ x: newX, y: newY });
  }
}

// Advance snake position, handle walls, check food, and detect self-collision
function updateGame() {
  if (directionQueue.length > 0) {
    direction = directionQueue.shift();
  }

  const head = snake[0];
  let nextX = head.x + direction.x;
  let nextY = head.y + direction.y;

  // Handle border mode: wrap around or collide with wall
  if (selectedWallMode === "Wrap") {
    nextX = (nextX + GRID_SIZE) % GRID_SIZE;
    nextY = (nextY + GRID_SIZE) % GRID_SIZE;
  } else if (
    nextX < 0 ||
    nextX >= GRID_SIZE ||
    nextY < 0 ||
    nextY >= GRID_SIZE
  ) {
    handleGameOver();
    return;
  }

  const nextHead = { x: nextX, y: nextY };
  const willEatFood = nextHead.x === food.x && nextHead.y === food.y;

  // Check self-collision (tail tip vacates its cell unless growing)
  const bodyToCheck = willEatFood ? snake : snake.slice(0, -1);
  const hitSelf = bodyToCheck.some(
    (segment) => segment.x === nextHead.x && segment.y === nextHead.y
  );

  if (hitSelf) {
    handleGameOver();
    return;
  }

  snake.unshift(nextHead);

  if (willEatFood) {
    score += 10;
    scoreDisplay.textContent = String(score);
    saveHighScore(score);
    spawnFood();
  } else {
    snake.pop();
  }
}

// Draw grid background, red apple, and green snake on the canvas
function drawGame() {
  ctx.fillStyle = "#fcfdfc";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "#eef2f6";
  ctx.lineWidth = 1;
  for (let i = 1; i < GRID_SIZE; i++) {
    const pos = i * TILE_SIZE;
    ctx.beginPath();
    ctx.moveTo(pos, 0);
    ctx.lineTo(pos, canvas.height);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, pos);
    ctx.lineTo(canvas.width, pos);
    ctx.stroke();
  }

  drawApple(food.x, food.y);
  drawSnake();
}

// Draw the food as a classic red apple
function drawApple(gridX, gridY) {
  const centerX = gridX * TILE_SIZE + TILE_SIZE / 2;
  const centerY = gridY * TILE_SIZE + TILE_SIZE / 2 + 1;
  const radius = TILE_SIZE * 0.36;

  ctx.fillStyle = "#dc2626";
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 255, 255, 0.28)";
  ctx.beginPath();
  ctx.arc(centerX - radius * 0.3, centerY - radius * 0.3, radius * 0.24, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#78350f";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(centerX, centerY - radius + 1);
  ctx.lineTo(centerX + 2, centerY - radius - 4);
  ctx.stroke();

  ctx.fillStyle = "#16a34a";
  ctx.beginPath();
  ctx.ellipse(centerX + 4, centerY - radius - 1, 3.5, 2, -0.5, 0, Math.PI * 2);
  ctx.fill();
}

// Helper to draw a rounded rectangle with broad browser support
function drawRoundedRect(x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();
}

// Draw each snake segment in green with rounded corners and head eyes
function drawSnake() {
  snake.forEach((segment, index) => {
    const isHead = index === 0;
    const x = segment.x * TILE_SIZE + 1.5;
    const y = segment.y * TILE_SIZE + 1.5;
    const size = TILE_SIZE - 3;

    ctx.fillStyle = isHead ? "#15803d" : "#22c55e";
    drawRoundedRect(x, y, size, size, isHead ? 6 : 5);

    if (isHead) {
      drawSnakeEyes(segment);
    }
  });
}

// Draw eyes facing the current movement direction
function drawSnakeEyes(head) {
  const baseX = head.x * TILE_SIZE;
  const baseY = head.y * TILE_SIZE;
  const eyeRadius = 2.1;

  let eye1 = { x: baseX + TILE_SIZE * 0.65, y: baseY + TILE_SIZE * 0.32 };
  let eye2 = { x: baseX + TILE_SIZE * 0.65, y: baseY + TILE_SIZE * 0.68 };

  if (direction.x === -1) {
    eye1 = { x: baseX + TILE_SIZE * 0.35, y: baseY + TILE_SIZE * 0.32 };
    eye2 = { x: baseX + TILE_SIZE * 0.35, y: baseY + TILE_SIZE * 0.68 };
  } else if (direction.y === -1) {
    eye1 = { x: baseX + TILE_SIZE * 0.32, y: baseY + TILE_SIZE * 0.35 };
    eye2 = { x: baseX + TILE_SIZE * 0.68, y: baseY + TILE_SIZE * 0.35 };
  } else if (direction.y === 1) {
    eye1 = { x: baseX + TILE_SIZE * 0.32, y: baseY + TILE_SIZE * 0.65 };
    eye2 = { x: baseX + TILE_SIZE * 0.68, y: baseY + TILE_SIZE * 0.65 };
  }

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(eye1.x, eye1.y, eyeRadius, 0, Math.PI * 2);
  ctx.arc(eye2.x, eye2.y, eyeRadius, 0, Math.PI * 2);
  ctx.fill();
}

// Keyboard Controls (active only on the Play page)
function handleKeyDown(event) {
  if (event.target && event.target.tagName === "INPUT") {
    return;
  }

  if (currentPage !== "play") {
    return;
  }

  const key = event.key.toLowerCase();
  const isMovementKey = [
    "arrowup",
    "arrowdown",
    "arrowleft",
    "arrowright",
    "w",
    "a",
    "s",
    "d",
  ].includes(key);

  if (isMovementKey && gameStatus === "PLAYING") {
    event.preventDefault();
  }

  if (key === "arrowup" || key === "w") {
    changeDirection(0, -1);
  } else if (key === "arrowdown" || key === "s") {
    changeDirection(0, 1);
  } else if (key === "arrowleft" || key === "a") {
    changeDirection(-1, 0);
  } else if (key === "arrowright" || key === "d") {
    changeDirection(1, 0);
  } else if (key === "p") {
    if (gameStatus === "PLAYING" || gameStatus === "PAUSED") {
      togglePause();
    }
  } else if (key === " " && (gameStatus === "PLAYING" || gameStatus === "PAUSED")) {
    event.preventDefault();
    togglePause();
  } else if (key === "enter") {
    if (gameStatus === "READY") {
      startGame();
    } else if (gameStatus === "GAME_OVER") {
      restartGame();
    }
  }
}

// Route Link & Button Navigation
routeTriggers.forEach((el) => {
  el.addEventListener("click", (event) => {
    event.preventDefault();
    navigateTo(el.dataset.route);
  });
});

gotoTriggers.forEach((btn) => {
  btn.addEventListener("click", () => {
    navigateTo(btn.dataset.goto);
  });
});

window.addEventListener("hashchange", () => {
  const hashPage = window.location.hash.replace("#", "") || "home";
  if (hashPage !== currentPage) {
    navigateTo(hashPage, false);
  }
});

// Main Menu Setup Controls
difficultyButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    selectedDifficulty = btn.dataset.difficulty;
    difficultyButtons.forEach((b) =>
      b.classList.toggle("active", b === btn)
    );
    updateModeDisplays();
    // Reset board if changing settings while idle or finished
    if (gameStatus !== "PLAYING") {
      clearTimeout(gameTimer);
      resetGameState();
      gameStatus = "READY";
      updateUIState();
      drawGame();
    }
  });
});

wallModeButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    selectedWallMode = btn.dataset.wallMode;
    wallModeButtons.forEach((b) =>
      b.classList.toggle("active", b === btn)
    );
    updateModeDisplays();
    if (gameStatus !== "PLAYING") {
      clearTimeout(gameTimer);
      resetGameState();
      gameStatus = "READY";
      updateUIState();
      drawGame();
    }
  });
});

// Helper to jump into the Play page and start/resume immediately
function enterPlayPageAndStart() {
  navigateTo("play");
  if (gameStatus === "READY" || gameStatus === "GAME_OVER") {
    startGame();
  } else if (gameStatus === "PAUSED") {
    togglePause();
  }
}

homePlayBtn.addEventListener("click", enterPlayPageAndStart);
headerPlayBtn.addEventListener("click", enterPlayPageAndStart);
homeLeaderboardBtn.addEventListener("click", () => navigateTo("leaderboard"));
homeHowToBtn.addEventListener("click", () => navigateTo("how-to-play"));
backToMenuBtn.addEventListener("click", () => navigateTo("home"));
pauseMenuBtn.addEventListener("click", () => navigateTo("home"));
gameOverLeaderboardBtn.addEventListener("click", () => navigateTo("leaderboard"));

// Game Action Buttons
startBtn.addEventListener("click", startGame);
overlayStartBtn.addEventListener("click", startGame);
pauseBtn.addEventListener("click", togglePause);
overlayResumeBtn.addEventListener("click", togglePause);
restartBtn.addEventListener("click", restartGame);
playAgainBtn.addEventListener("click", restartGame);

// Save score form submission
saveScoreForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (scoreSavedThisRound || score <= 0) return;

  addLeaderboardEntry(playerNameInput.value, score);
  scoreSavedThisRound = true;
  saveScoreBtn.disabled = true;
  playerNameInput.disabled = true;
  saveFeedback.textContent = "Score saved to leaderboard!";
});

// Leaderboard Filter Tabs
filterButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    activeFilter = btn.dataset.filter;
    filterButtons.forEach((b) =>
      b.classList.toggle("active", b === btn)
    );
    renderLeaderboard();
  });
});

// Two-step clear leaderboard button (avoids browser confirm popups)
clearLeaderboardBtn.addEventListener("click", () => {
  if (clearLeaderboardBtn.dataset.confirming === "true") {
    clearTimeout(clearConfirmTimer);
    leaderboard = [];
    saveLeaderboard();
    renderLeaderboard();
    clearLeaderboardBtn.dataset.confirming = "false";
    clearLeaderboardBtn.textContent = "Clear Scores";
    return;
  }

  clearLeaderboardBtn.dataset.confirming = "true";
  clearLeaderboardBtn.textContent = "Confirm Clear?";
  clearConfirmTimer = setTimeout(() => {
    clearLeaderboardBtn.dataset.confirming = "false";
    clearLeaderboardBtn.textContent = "Clear Scores";
  }, 3000);
});

// Mobile on-screen arrow buttons
btnUp.addEventListener("click", () => changeDirection(0, -1));
btnDown.addEventListener("click", () => changeDirection(0, 1));
btnLeft.addEventListener("click", () => changeDirection(-1, 0));
btnRight.addEventListener("click", () => changeDirection(1, 0));

document.addEventListener("keydown", handleKeyDown);

// Initialize application state and initial route
function initGame() {
  loadHighScore();
  loadLeaderboard();
  resetGameState();
  updateModeDisplays();
  updateUIState();
  drawGame();

  const initialPage = window.location.hash.replace("#", "") || "home";
  navigateTo(initialPage, false);
}

initGame();
