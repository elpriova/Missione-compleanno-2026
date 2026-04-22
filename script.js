const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let dialogOverlay;
let dialogText;
document.addEventListener("DOMContentLoaded", () => {

  dialogOverlay = document.getElementById("dialog-overlay");
  dialogText = document.getElementById("dialog-text");

  document.getElementById("startBtn").onclick = () => {

    console.log("▶ START GAME");

    document.getElementById("intro").style.display = "none";

    gameStarted = false;
    gameFinished = false;

    startDialog();
  };
});

const dialogues = [
  "Eleonora: Ciao! Sei pronto per la Missione?",
  "Muoviti con le frecce. Quando sarai vicino, la lettera si illuminerà.",
  "Raccogli tutte le lettere sparse nella mappa.",
  "Premi A per raccogliere lettere vicine.",
  "Premi B per vedere un aiuto.",
  "Completa la frase per vincere!",
  "Buona fortuna!"
];

let dialogIndex = 0;
let typing = false;

const TILE = 32;
const SIZE = 10;

canvas.width = TILE * SIZE;
canvas.height = TILE * SIZE;

// =====================
// STATO GIOCO
// =====================
let gameStarted = false;
let gameFinished = false;
let isFading = false;
// =====================
// PLAYER
// =====================
let player = { x: 5, y: 5 };

// =====================
// MAPPA
// =====================
const map = [];
const objects = [];
const grassDecor = [];
const treeDecor = [];
const rockDecor = [];

for (let y = 0; y < SIZE; y++) {

  map[y] = [];

  for (let x = 0; x < SIZE; x++) {

    let r = Math.random();

    if (r < 0.6) map[y][x] = 0;
    else if (r < 0.9) map[y][x] = 2;
    else map[y][x] = 1;

    objects[y * SIZE + x] =
      map[y][x] === 1 ? (Math.random() < 0.5 ? "tree" : "rock") : null;

    // 🌿 ERBA CACHE (QUI DENTRO IL CICLO GIUSTO)
    if (map[y][x] === 2) {

      grassDecor[y * SIZE + x] = [];

      for (let i = 0; i < 3; i++) {
        grassDecor[y * SIZE + x].push({
          ox: Math.floor(Math.random() * TILE),
          oy: Math.floor(Math.random() * TILE),
          type: Math.random() < 0.5 ? "dark" : "light"
        });
      }

    } else {
      grassDecor[y * SIZE + x] = null;
    }
  }
}

// =====================
// LETTERE
// =====================
const target = "TANTIAUGURI".split("");
let letters = [];
let phrase = Array(target.length).fill("_");

// =====================
// COLORI
// =====================
const COLORS = {
  ground: "#dcdcdc",
  grass: "#368600",
  trunk: "#5b5b5b",
  leaf: "#7a8f7a"
};

// =====================
// AUDIO BASE
// =====================
let bgInterval = null;

function startMusic() {
  if (bgInterval) return;

  const notes = [262, 294, 330, 392, 330, 294, 262, 220];
  let i = 0;

  bgInterval = setInterval(() => {

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = "triangle";
    osc.frequency.value = notes[i];

    gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.4, audioCtx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.4);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.26);

    i = (i + 1) % notes.length;

  }, 500);
}

function stopMusic() {
  if (bgInterval) {
    clearInterval(bgInterval);
    bgInterval = null;
  }
}

function playVictoryMusic() {

  const notes = [
    523, 659, 784, 1046 // DO MI SOL DO (vittoria semplice)
  ];

  let i = 0;

  const interval = setInterval(() => {

    if (i >= notes.length) {
      clearInterval(interval);
      return;
    }

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = "square";
    osc.frequency.value = notes[i];

    gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.4, audioCtx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.4);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.4);

    i++;

  }, 300);
}

// =====================
// SUONO
// =====================
function beep() {
  const audio = new (window.AudioContext || window.webkitAudioContext)();

  const osc = audio.createOscillator();
  const gain = audio.createGain();

  osc.type = "square";
  osc.frequency.value = 700;

  gain.gain.value = 0.2;

  osc.connect(gain);
  gain.connect(audio.destination);

  osc.start();
  osc.stop(audio.currentTime + 0.1);
}

function dialogBeep() {

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = "square";
  osc.frequency.value = 900; // più acuto stile Pokémon

  gain.gain.setValueAtTime(0.001, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.2, audioCtx.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start();
  osc.stop(audioCtx.currentTime + 0.08);
}

// =====================
// LETTERE LOGICA
// =====================
function generateLetters() {
  letters = [];

  for (let i = 0; i < target.length; i++) {

    let placed = false;

    while (!placed) {

      let x = Math.floor(Math.random() * SIZE);
      let y = Math.floor(Math.random() * SIZE);

      if (!map[y] || map[y][x] === undefined) continue;

      if ((map[y][x] === 0 || map[y][x] === 2) &&
          !(x === player.x && y === player.y)) {

        letters.push({
          x,
          y,
          char: target[i],
          got: false,
          active: false,
          sparkleBoost: 0
        });

        placed = true;
      }
    }
  }
}

function isNear(p, l) {
  return Math.abs(p.x - l.x) <= 1 &&
         Math.abs(p.y - l.y) <= 1;
}

function updateLetters() {
  letters.forEach(l => {
    if (l.got) return;

    l.active = isNear(player, l);

    if (l.sparkleBoost > 0) {
      l.sparkleBoost--;
    }
  });
}

// =====================
// MOVIMENTO
// =====================
function move(dx, dy) {

  if (!gameStarted || gameFinished) return;

  const nx = player.x + dx;
  const ny = player.y + dy;

  if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) return;
  if (map[ny][nx] === 1) return;

  player.x = nx;
  player.y = ny;

  for (let l of letters) {
    if (!l.got && l.x === nx && l.y === ny) {
      l.got = true;
      beep();
      updatePhrase(l.char);
    }
  }

  if (letters.length > 0 && letters.every(l => l.got)) {
    gameFinished = true;
    stopMusic();
    startPixelFade();
  }
}

// =====================
// INPUT
// =====================
document.addEventListener("keydown", e => {

  // 🎮 MOVIMENTO (solo durante il gioco)
  if (gameStarted) {
    if (e.key === "ArrowUp") move(0, -1);
    if (e.key === "ArrowDown") move(0, 1);
    if (e.key === "ArrowLeft") move(-1, 0);
    if (e.key === "ArrowRight") move(1, 0);
  }

  // 💬 DIALOGO (solo prima del gioco)
  if (!gameStarted && (e.key === "Enter" || e.key === " ")) {
    if (!typing) {
      dialogBeep();
      showNextDialog();
    }
  }

});

document.getElementById("up").onclick = () => move(0, -1);
document.getElementById("down").onclick = () => move(0, 1);
document.getElementById("left").onclick = () => move(-1, 0);
document.getElementById("right").onclick = () => move(1, 0);

// =====================
// A / B
// =====================
document.addEventListener("DOMContentLoaded", () => {

 document.getElementById("aBtn").onclick = () => {

  // 👉 SE DIALOGO ATTIVO → AVANZA DIALOGO
  if (!gameStarted) {
    if (!typing) {
      dialogBeep(); 
      showNextDialog();
    }
    return;
  }

  // 👉 SE GIOCO ATTIVO → RACCOGLI LETTERE
  letters.forEach(l => {
    if (!l.got && l.active) {
      l.got = true;
      beep();
      updatePhrase(l.char);
    }
  });
};

  document.getElementById("bBtn").onclick = () => {
    letters.forEach(l => {
      if (!l.got) l.sparkleBoost = 90;
    });
  };

});

// =====================
// FRASE
// =====================
function updatePhrase(ch) {
  for (let i = 0; i < target.length; i++) {
    if (target[i] === ch && phrase[i] === "_") {
      phrase[i] = ch;
      break;
    }
  }

  document.getElementById("phrase").innerText =
    phrase.join(" ");
}

// =====================
// MAPPA
// =====================
function drawMap() {

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {

      const px = x * TILE;
      const py = y * TILE;

      ctx.fillStyle = COLORS.ground;
      ctx.fillRect(px, py, TILE, TILE);

      if (map[y][x] === 2) {

  // base erba uniforme
  ctx.fillStyle = COLORS.grass;
  ctx.fillRect(px, py, TILE, TILE);

  const deco = grassDecor[y * SIZE + x];

  if (deco) {
    for (let i = 0; i < deco.length; i++) {

      const d = deco[i];

      ctx.fillStyle = d.type === "dark"
        ? "rgba(0,0,0,0.15)"
        : "rgba(255,255,255,0.10)";

      ctx.fillRect(px + d.ox, py + d.oy, 2, 2);
    }
  }
}

      if (map[y][x] === 1) {
        let obj = objects[y * SIZE + x];

        if (obj === "tree") {

  // TRONCO (più semplice e spesso)
  ctx.fillStyle = "#5a3a1a";
  ctx.fillRect(px + 14, py + 18, 4, 10);

  // CHIOMA A BLOCCHI (stile Game Boy)
  ctx.fillStyle = "#2f6b2f";
  ctx.fillRect(px + 6, py + 6, 20, 10);
  ctx.fillRect(px + 10, py + 2, 12, 10);

  // STRATO SUPERIORE (più chiaro)
  ctx.fillStyle = "#3f8f3f";
  ctx.fillRect(px + 12, py + 0, 8, 8);

  // PIXEL DETTAGLI (rumore leggero Pokémon style)
  for (let i = 0; i < 4; i++) {

    const ox = Math.floor(Math.random() * 20);
    const oy = Math.floor(Math.random() * 12);

    ctx.fillStyle = "rgba(0,0,0,0.15)";
    ctx.fillRect(px + 6 + ox, py + 2 + oy, 2, 2);
  }

  // piccoli highlight chiari
  for (let i = 0; i < 3; i++) {

    const ox = Math.floor(Math.random() * 20);
    const oy = Math.floor(Math.random() * 12);

    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(px + 6 + ox, py + 2 + oy, 2, 2);
  }
}if (obj === "tree") {

  // tronco
  ctx.fillStyle = "#5a3a1a";
  ctx.fillRect(px + 14, py + 18, 4, 10);

  // chioma unica (niente layering instabile)
  ctx.fillStyle = "#2f6b2f";
  ctx.fillRect(px + 8, py + 6, 16, 12);

  // top highlight fisso
  ctx.fillStyle = "#3f8f3f";
  ctx.fillRect(px + 10, py + 2, 12, 8);
}

        if (obj === "rock") {

  ctx.fillStyle = "#7a7a7a";
  ctx.fillRect(px + 8, py + 10, 16, 12);
  ctx.fillRect(px + 10, py + 6, 12, 10);

  ctx.fillStyle = "#5c5c5c";
  ctx.fillRect(px + 8, py + 14, 16, 8);

  ctx.fillStyle = "#a8a8a8";
  ctx.fillRect(px + 10, py + 8, 4, 4);
}
      }
    }
  }
}

// =====================
// LETTERE DRAW
// =====================
function drawLetters() {

  letters.forEach(l => {

    if (l.got) return;

    const px = l.x * TILE;
    const py = l.y * TILE;

    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fillRect(px + 12, py + 12, 8, 8);

    if (l.active || l.sparkleBoost > 0) {

      let t = Date.now() * 0.01;

      ctx.fillStyle = "white";

      ctx.fillRect(px + 10, py + 8 + Math.sin(t), 2, 2);
      ctx.fillRect(px + 16, py + 12 - Math.sin(t), 2, 2);
      ctx.fillRect(px + 20, py + 6 + Math.cos(t), 2, 2);
    }
  });
}

// =====================
// PLAYER
// =====================
function drawPlayer() {

  const px = player.x * TILE;
  const py = player.y * TILE;

  ctx.fillStyle = "#c1121f";
  ctx.fillRect(px + 10, py + 2, 12, 3);

  ctx.fillStyle = "#ffcc99";
  ctx.fillRect(px + 9, py + 5, 14, 10);

  ctx.fillStyle = "#000";
  ctx.fillRect(px + 13, py + 9, 2, 2);
  ctx.fillRect(px + 17, py + 9, 2, 2);

  ctx.fillStyle = "#1d3557";
  ctx.fillRect(px + 10, py + 15, 12, 4);

  ctx.fillStyle = "#222";
  ctx.fillRect(px + 12, py + 19, 3, 4);
  ctx.fillRect(px + 17, py + 19, 3, 4);
}

// =====================
// CHECK WIN
// =====================
function checkWin() {

  if (!gameStarted || gameFinished) return;

  if (letters.length === 0) return;

  let allCollected = true;

  for (let i = 0; i < letters.length; i++) {
    if (!letters[i].got) {
      allCollected = false;
      break;
    }
  }

  if (!allCollected) return;

  console.log("🏁 WIN OK");

  gameFinished = true;

  stopMusic();

  // 💥 forza esecuzione sicura su frame successivo
  requestAnimationFrame(() => {

    console.log("➡️ START FADE");

    if (typeof startPixelFade === "function") {
      startPixelFade();
    } else {
      console.error("startPixelFade MANCANTE");
    }
  });
}
// =====================
// PIXEL FADE
// =====================

function startPixelFade() {

  console.log("POKEMON FADE START");

  isFading = true;

  const tile = 8;

  const cols = Math.ceil(canvas.width / tile);
  const rows = Math.ceil(canvas.height / tile);

  let currentCol = 0;

  function step() {

    // ridisegna mondo sotto
    drawMap();
    drawPlayer();
    drawLetters();

    // 🟦 wipe verticale progressivo (stile Pokémon)
    for (let x = 0; x <= currentCol; x++) {

      for (let y = 0; y < rows; y++) {

        ctx.fillStyle = "black";
        ctx.fillRect(
          x * tile,
          y * tile,
          tile,
          tile
        );
      }
    }

    currentCol += 1.2; // velocità fade (puoi regolarla)

    if (currentCol < cols) {
      requestAnimationFrame(step);
    } else {

      console.log("FADE FINITO");

      isFading = false;

      // schermo completamente nero
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 🎯 delay più “RPG”
      setTimeout(() => {

        showFinalText();
        playVictoryMusic();

      }, 900);
    }
  }

  step();
}
// =====================
// FINAL TEXT
// =====================

function showFinalText() {

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // sfondo nero finale
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // testo bianco
  ctx.fillStyle = "white";
  ctx.font = "18px monospace";
  ctx.textAlign = "center";

  ctx.fillText("🎂 Buon Compleanno Ale! 🎂", canvas.width / 2, canvas.height / 2);
}

// =====================
// TYPE TEXT
// =====================

function typeText(text, callback) {

  dialogText.innerHTML = "";
  typing = true;

  let i = 0;

  const interval = setInterval(() => {

    dialogText.innerHTML += text[i];
    i++;

    if (i >= text.length) {
      clearInterval(interval);
      typing = false;
      callback && callback();
    }

  }, 25);
}
// =====================
// DIALOG
// =====================

function startDialog() {

  dialogOverlay.classList.remove("hidden");

  canvas.style.display = "none";
  document.getElementById("phrase").style.display = "none";

  dialogIndex = 0;
  showNextDialog();
}

function showNextDialog() {

  if (dialogIndex >= dialogues.length) {
    dialogOverlay.classList.add("hidden");
    startGameAfterDialog();
    return;
  }

  typeText(dialogues[dialogIndex], () => {
    dialogIndex++;
  });

  dialogOverlay.onclick = () => {
    if (!typing) {
      showNextDialog();
    }
  };
}

    function enableDialogClick() {
  dialogOverlay.onclick = () => {
    if (!typing) showNextDialog();
  };
}


function startGameAfterDialog() {

  dialogOverlay.classList.add("hidden");

  canvas.style.display = "block";
  document.getElementById("phrase").style.display = "block";

  gameStarted = true;
  gameFinished = false;

  player = { x: 5, y: 5 };

  generateLetters();
  startMusic();

  requestAnimationFrame(loop);
}

// =====================
// LOOP
// =====================
function loop() {

  if (!gameStarted) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 💥 BLOCCO DURANTE FADE
  if (gameFinished && isFading) return;

  if (!gameFinished) {
    updateLetters();
    drawMap();
    drawPlayer();
    drawLetters();
    checkWin();
  }

  requestAnimationFrame(loop);
}

// =====================
// START
// =====================
document.addEventListener("DOMContentLoaded", () => {

  document.getElementById("startBtn").onclick = () => {

    console.log("▶ START GAME");

    document.getElementById("intro").style.display = "none";

    gameStarted = false;
    gameFinished = false;

    startDialog();
  };

});
