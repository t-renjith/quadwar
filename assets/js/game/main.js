import { GameLogic } from './logic.js';
import { CONSTANTS } from './constants.js';
import { NetworkManager } from './network.js';

// DOM Elements
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('statusMessage');
const turnIndicator = document.getElementById('turnIndicator');
const logPanel = document.getElementById('logPanel');

// State
let game = null;
let network = null;
let gameMode = 'local'; // local, cpu, online
let myPlayer = CONSTANTS.PLAYER_RED; // Default for local/cpu
let isOnline = false;
let pendingEquations = null; // To track animation state
let isAnimating = false;

// Setup Canvas
canvas.width = CONSTANTS.COLS * CONSTANTS.TILE_SIZE;
canvas.height = CONSTANTS.ROWS * CONSTANTS.TILE_SIZE;

// Init
function init() {
    const params = new URLSearchParams(window.location.search);
    gameMode = params.get('mode') || 'local';

    game = new GameLogic();

    // UI Setup
    if (gameMode === 'online') {
        setupOnlineMode();
    } else if (gameMode === 'cpu') {
        myPlayer = CONSTANTS.PLAYER_BLUE; // Human is Blue vs CPU
        startLocalGame();
    } else {
        startLocalGame();
    }

    // Input
    canvas.addEventListener('click', handleInput);

    // Loop
    requestAnimationFrame(gameLoop);
}

function startLocalGame() {
    statusEl.innerHTML = `Game Started: ${gameMode.toUpperCase()}`;
    updateUI();
}

function setupOnlineMode() {
    isOnline = true;
    network = new NetworkManager();

    // Show Online Menu
    const menuHtml = `
        <div id="onlineMenu" class="game-modal visible">
            <h3>Online Multiplayer</h3>
            <p>Share your ID or Join a friend</p>
            <div id="myIdContainer">Connecting to server...</div>
            <br>
            <input type="text" id="joinIdInput" placeholder="Friend's ID" style="padding: 5px;">
            <button id="joinBtn" class="game-btn">Join</button>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', menuHtml);

    network.init((id) => {
        document.getElementById('myIdContainer').innerHTML = `My ID: <strong style="color:var(--accent-blue); user-select: text;">${id}</strong>`;
    });

    network.onConnect = () => {
        document.getElementById('onlineMenu').remove();
        statusEl.textContent = "Connected! Game Starting...";
        // Assign roles: If I initiated connection, I am P2 (Blue). If I hosted, I am P1 (Red).
        // Wait, PeerJS "connection" event is on Host. "connect()" is on Joiner.
        // Actually, let's keep it simple:
        // Host (Peer server creator) = Blue? (Rules say Host=Blue, Joiner=Red).
        // Let's stick to rule: "Host: Plays as Blue. Joiner: Plays as Red."

        // Determining who is who:
        if (network.conn.metadata && network.conn.metadata.role) {
            // We can pass metadata during connect
        } else {
            // Simplest: The one who CALLED receive 'open' first? No.
            // We need to know if we are the 'host' (waited) or 'client' (dialed).
        }
    };

    network.onData = (msg) => {
        if (msg.type === 'MOVE') {
            const { from, to } = msg.data;
            executeMove(from, to);
        }
    };

    // Join Button Logic
    document.getElementById('joinBtn').addEventListener('click', () => {
        const targetId = document.getElementById('joinIdInput').value;
        if (targetId) {
            network.connect(targetId);
            myPlayer = CONSTANTS.PLAYER_RED; // Joiner is Red
            statusEl.textContent = "Joining...";
            document.getElementById('onlineMenu').remove();
        }
    });

    // If we wait, we are Host -> Blue
    // But we need to know that we are waiting.
    // Let's assume if we didn't click Join, and we get a connection, we are Host.
    network.onConnect = () => {
        document.getElementById('onlineMenu').remove();
        if (myPlayer === CONSTANTS.PLAYER_RED) {
            // I submitted 'connect', so I am Red
        } else {
            // I accepted connection, so I am Host (Blue)
            myPlayer = CONSTANTS.PLAYER_BLUE;
        }
        statusEl.textContent = `Online Game. You are ${myPlayer === CONSTANTS.PLAYER_RED ? 'RED' : 'BLUE'}`;
        updateUI();
    };
}

function handleInput(e) {
    if (game.gameOver || isAnimating) return;

    // Check Turn
    if (isOnline && game.currentPlayer !== myPlayer) return;
    // Check Turn
    if (isOnline && game.currentPlayer !== myPlayer) return;
    if (gameMode === 'cpu' && game.currentPlayer !== CONSTANTS.PLAYER_BLUE) return; // Player is Blue vs CPU

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const col = Math.floor(x / CONSTANTS.TILE_SIZE);
    const row = Math.floor(y / CONSTANTS.TILE_SIZE);

    // Selection Logic
    if (game.selectedPiece) {
        // Try to Move
        const validMoves = game.getValidMoves(game.selectedPiece.r, game.selectedPiece.c);
        const isMove = validMoves.some(m => m.r === row && m.c === col);

        if (isMove) {
            const from = { r: game.selectedPiece.r, c: game.selectedPiece.c };
            const to = { r: row, c: col };

            executeMove(from, to);

            if (isOnline) {
                network.sendMove({ from, to });
            }
        } else {
            // Deselect or Select Other
            const p = game.getPiece(row, col);
            if (p && p.player === game.currentPlayer && p.player === (isOnline ? myPlayer : game.currentPlayer)) {
                game.selectedPiece = { r: row, c: col };
            } else {
                game.selectedPiece = null;
            }
        }
    } else {
        // Select
        const p = game.getPiece(row, col);
        if (p && p.player === game.currentPlayer) {
            // Online/CPU Check
            if (isOnline && p.player !== myPlayer) return;

            game.selectedPiece = { r: row, c: col };
        }
    }
}

function executeMove(from, to) {
    const response = game.movePiece(from.r, from.c, to.r, to.c);
    const results = response.events;

    game.selectedPiece = null;

    // Log Results
    if (results && results.length > 0) {
        results.forEach(res => {
            logEvent(res);
        });
    }

    if (response.pending) {
        // Start Animation
        isAnimating = true;
        pendingEquations = results;

        // Wait then finalize
        setTimeout(() => {
            game.completeTurn(results);
            pendingEquations = null;
            isAnimating = false;
            updateUI();
            checkGameOver();
            checkCpuTurn();
        }, 2000); // 2 seconds delay
    } else {
        updateUI();
        checkGameOver();
        checkCpuTurn();
    }
}

function checkGameOver() {
    if (game.gameOver) {
        alert("GAME OVER! Winner: " + (game.winner === CONSTANTS.PLAYER_RED ? "Red" : "Blue"));
    }
}

function checkCpuTurn() {
    // CPU Turn
    if (gameMode === 'cpu' && game.currentPlayer === CONSTANTS.PLAYER_RED && !game.gameOver && !isAnimating) {
        setTimeout(() => {
            const cpuMove = game.aiMove();
            if (cpuMove) {
                executeMove(cpuMove.from, cpuMove.to);
            } else {
                console.log("CPU has no moves!");
                game.currentPlayer = CONSTANTS.PLAYER_RED;
                updateUI();
            }
        }, 500);
    }
}

function logEvent(res) {
    const isRed = game.currentPlayer === CONSTANTS.PLAYER_RED;
    const colorStyle = isRed ? 'color: #ff3366;' : 'color: #00ccff;'; // Manual colors or vars

    const div = document.createElement('div');
    div.className = 'log-entry';
    div.innerHTML = `
        <div class="log-eq" style="${colorStyle}">${res.equation}</div>
        <div style="color: #fff;">Δ = ${res.delta} (${res.realRoots ? 'Real' : 'Complex'})</div>
        <div class="${res.realRoots ? 'log-good' : 'log-bad'}" style="color: #fff;">
            ${res.realRoots ? 'BOOM! Enemy Destroyed' : 'BACKFIRE! Friendly Fire'}
        </div>
    `;
    logPanel.prepend(div);
}

function updateUI() {
    const isRed = game.currentPlayer === CONSTANTS.PLAYER_RED;
    turnIndicator.textContent = `${isRed ? "RED" : "BLUE"}'s Turn`;
    turnIndicator.className = `turn-indicator ${isRed ? 'turn-red' : 'turn-blue'}`;
}

function gameLoop() {
    render();
    requestAnimationFrame(gameLoop);
}

function render() {
    // Clear
    // Clear & Draw Checkerboard
    for (let r = 0; r < CONSTANTS.ROWS; r++) {
        for (let c = 0; c < CONSTANTS.COLS; c++) {
            const isDark = (r + c) % 2 === 1;
            ctx.fillStyle = isDark ? CONSTANTS.COLOR_BOARD_DARK : CONSTANTS.COLOR_BOARD_LIGHT;
            ctx.fillRect(c * CONSTANTS.TILE_SIZE, r * CONSTANTS.TILE_SIZE, CONSTANTS.TILE_SIZE, CONSTANTS.TILE_SIZE);
        }
    }

    // Draw Grid
    ctx.lineWidth = 1;
    ctx.strokeStyle = CONSTANTS.COLOR_GRID;
    for (let r = 0; r <= CONSTANTS.ROWS; r++) {
        ctx.beginPath();
        ctx.moveTo(0, r * CONSTANTS.TILE_SIZE);
        ctx.lineTo(canvas.width, r * CONSTANTS.TILE_SIZE);
        ctx.stroke();
    }
    for (let c = 0; c <= CONSTANTS.COLS; c++) {
        ctx.beginPath();
        ctx.moveTo(c * CONSTANTS.TILE_SIZE, 0);
        ctx.lineTo(c * CONSTANTS.TILE_SIZE, canvas.height);
        ctx.stroke();
    }

    // Highlight Selected & Valid Moves
    if (game.selectedPiece) {
        // Highlight logic
        const { r, c } = game.selectedPiece;
        ctx.fillStyle = CONSTANTS.COLOR_HIGHLIGHT;
        ctx.fillRect(c * CONSTANTS.TILE_SIZE, r * CONSTANTS.TILE_SIZE, CONSTANTS.TILE_SIZE, CONSTANTS.TILE_SIZE);

        const moves = game.getValidMoves(r, c);
        ctx.fillStyle = CONSTANTS.COLOR_VALID_MOVE;
        for (let m of moves) {
            ctx.fillRect(m.c * CONSTANTS.TILE_SIZE, m.r * CONSTANTS.TILE_SIZE, CONSTANTS.TILE_SIZE, CONSTANTS.TILE_SIZE);
        }
    }

    // Draw Pending Equation Highlights
    if (pendingEquations) {
        pendingEquations.forEach(eq => {
            // Highlight Chain (Gold Border)
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 3;
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#ffd700';

            eq.chain.forEach(item => {
                ctx.strokeRect(item.c * CONSTANTS.TILE_SIZE, item.r * CONSTANTS.TILE_SIZE, CONSTANTS.TILE_SIZE, CONSTANTS.TILE_SIZE);
            });

            // Reset Shadow
            ctx.shadowBlur = 0;

            // Highlight Victims (Pulsing Red)
            eq.removed.forEach(item => {
                const x = item.c * CONSTANTS.TILE_SIZE;
                const y = item.r * CONSTANTS.TILE_SIZE;

                ctx.fillStyle = `rgba(255, 0, 0, ${0.3 + Math.sin(Date.now() / 100) * 0.2})`; // Pulse
                ctx.fillRect(x, y, CONSTANTS.TILE_SIZE, CONSTANTS.TILE_SIZE);

                // Cross mark
                ctx.beginPath();
                ctx.strokeStyle = 'red';
                ctx.lineWidth = 4;
                ctx.moveTo(x + 10, y + 10);
                ctx.lineTo(x + CONSTANTS.TILE_SIZE - 10, y + CONSTANTS.TILE_SIZE - 10);
                ctx.moveTo(x + CONSTANTS.TILE_SIZE - 10, y + 10);
                ctx.lineTo(x + 10, y + CONSTANTS.TILE_SIZE - 10);
                ctx.stroke();
            });
        });
    }

    // Draw Pieces
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 16px monospace'; // var(--font-mono)

    for (let r = 0; r < CONSTANTS.ROWS; r++) {
        for (let c = 0; c < CONSTANTS.COLS; c++) {
            const p = game.board[r][c];
            if (p) {
                const x = c * CONSTANTS.TILE_SIZE + CONSTANTS.TILE_SIZE / 2;
                const y = r * CONSTANTS.TILE_SIZE + CONSTANTS.TILE_SIZE / 2;

                // Piece Circle
                ctx.fillStyle = p.player === CONSTANTS.PLAYER_RED ? CONSTANTS.COLOR_RED : CONSTANTS.COLOR_BLUE;
                ctx.beginPath();
                ctx.arc(x, y, 25, 0, Math.PI * 2);
                ctx.fill();

                // Text
                ctx.fillStyle = '#fff';
                ctx.fillText(p.label, x, y);
            }
        }
    }
}

// Start
init();
