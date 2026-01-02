import { GameLogic } from './logic.js';
import { CONSTANTS } from './constants.js';
import { NetworkManager } from './network.js';

// DOM Elements
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const headerTitle = document.getElementById('headerTitle');
const turnBar = document.getElementById('turnBar');
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
    headerTitle.textContent = `${gameMode.toUpperCase()} MODE`;
    updateUI();
}

function setupOnlineMode() {
    isOnline = true;
    headerTitle.textContent = "Connecting...";
    turnBar.textContent = "Waiting for Online Menu...";
    network = new NetworkManager();

    // Show Online Menu
    const menuHtml = `
        <div id="onlineMenu" class="game-modal visible">
            <h3>Online Multiplayer</h3>
            <p>Share your ID</p>
            <div id="myIdContainer">Connecting...</div>
            <button id="copyLinkBtn" class="game-btn" style="margin: 5px 0; font-size:0.8rem;">Copy ID</button>
            <br><br>
            <p>Or join a friend:</p>
            <input type="text" id="joinIdInput" placeholder="Friend's ID" style="padding: 5px;">
            <button id="joinBtn" class="game-btn">Join</button>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', menuHtml);

    network.init((id) => {
        document.getElementById('myIdContainer').innerHTML = `ID: <strong style="color:var(--accent-blue); user-select: text;">${id}</strong>`;

        // Setup Copy ID
        const linkBtn = document.getElementById('copyLinkBtn');
        if (linkBtn) {
            linkBtn.onclick = () => {
                navigator.clipboard.writeText(id).then(() => {
                    linkBtn.textContent = "Copied!";
                    setTimeout(() => linkBtn.textContent = "Copy ID", 2000);
                });
            };
        }

        // Check for Auto-Join
        const params = new URLSearchParams(window.location.search);
        const joinId = params.get('join');
        if (joinId) {
            console.log("Auto-joining ID:", joinId);
            document.getElementById('joinIdInput').value = joinId;
            document.getElementById('joinBtn').click();
        }

    }, (err) => {
        headerTitle.textContent = "Online Error: " + err;
        turnBar.textContent = "Check console for details.";
    });

    network.onConnect = (isHost) => {
        const menuEl = document.getElementById('onlineMenu');
        if (menuEl) menuEl.remove();
        headerTitle.textContent = "Connected! Game Starting...";

        // Role Logic:
        // Host (Server) = PLAYER_BLUE
        // Client (Joiner) = PLAYER_RED
        if (isHost) {
            myPlayer = CONSTANTS.PLAYER_BLUE;
        } else {
            myPlayer = CONSTANTS.PLAYER_RED;
        }

        headerTitle.textContent = `ONLINE (${myPlayer === CONSTANTS.PLAYER_RED ? 'Red' : 'Blue'})`;
        updateUI();
    };

    network.onData = (msg) => {
        if (msg.type === 'MOVE') {
            const { from, to } = msg.data;
            executeMove(from, to);
        }
    };

    // Join Button Logic
    document.getElementById('joinBtn').addEventListener('click', () => {
        const targetId = document.getElementById('joinIdInput').value.trim();
        if (targetId) {
            network.connect(targetId);
            myPlayer = CONSTANTS.PLAYER_RED; // Joiner is Red
            headerTitle.textContent = "Joining...";
            document.getElementById('onlineMenu').remove();
        }
    });

    // If we wait, we are Host -> Blue
    // But we need to know that we are waiting.
    // Let's assume if we didn't click Join, and we get a connection, we are Host.

}

function shouldRotateBoard() {
    return isOnline && myPlayer === CONSTANTS.PLAYER_RED;
}

function handleInput(e) {
    if (game.gameOver || isAnimating) return;

    // Check Turn
    if (isOnline && game.currentPlayer !== myPlayer) return;

    if (gameMode === 'cpu' && game.currentPlayer !== CONSTANTS.PLAYER_BLUE) return; // Player is Blue vs CPU

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    let col = Math.floor(x / CONSTANTS.TILE_SIZE);
    let row = Math.floor(y / CONSTANTS.TILE_SIZE);

    if (shouldRotateBoard()) {
        col = CONSTANTS.COLS - 1 - col;
        row = CONSTANTS.ROWS - 1 - row;
    }

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
    // Top Bar Title
    if (isOnline) {
        headerTitle.textContent = `ONLINE (${myPlayer === CONSTANTS.PLAYER_RED ? 'Red' : 'Blue'})`;
    } else {
        headerTitle.textContent = `${gameMode.toUpperCase()} MODE`;
    }

    // Turn Bar
    const isRed = game.currentPlayer === CONSTANTS.PLAYER_RED;
    turnBar.textContent = `${isRed ? "RED" : "BLUE"}'s Turn`;
    turnBar.className = `board-bottom-bar ${isRed ? 'turn-red' : 'turn-blue'}`;
}

function gameLoop() {
    render();
    requestAnimationFrame(gameLoop);
}

function render() {
    // Clear
    // Clear & Draw Checkerboard
    const rotate = shouldRotateBoard();

    for (let r = 0; r < CONSTANTS.ROWS; r++) {
        for (let c = 0; c < CONSTANTS.COLS; c++) {
            let drawR = r;
            let drawC = c;
            if (rotate) {
                drawR = CONSTANTS.ROWS - 1 - r;
                drawC = CONSTANTS.COLS - 1 - c;
            }

            const isDark = (r + c) % 2 === 1;
            ctx.fillStyle = isDark ? CONSTANTS.COLOR_BOARD_DARK : CONSTANTS.COLOR_BOARD_LIGHT;
            ctx.fillRect(drawC * CONSTANTS.TILE_SIZE, drawR * CONSTANTS.TILE_SIZE, CONSTANTS.TILE_SIZE, CONSTANTS.TILE_SIZE);
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

        let drawR = r;
        let drawC = c;
        if (rotate) {
            drawR = CONSTANTS.ROWS - 1 - r;
            drawC = CONSTANTS.COLS - 1 - c;
        }

        ctx.fillStyle = CONSTANTS.COLOR_HIGHLIGHT;
        ctx.fillRect(drawC * CONSTANTS.TILE_SIZE, drawR * CONSTANTS.TILE_SIZE, CONSTANTS.TILE_SIZE, CONSTANTS.TILE_SIZE);

        const moves = game.getValidMoves(r, c);
        ctx.fillStyle = CONSTANTS.COLOR_VALID_MOVE;
        for (let m of moves) {
            let mDrawR = m.r;
            let mDrawC = m.c;
            if (rotate) {
                mDrawR = CONSTANTS.ROWS - 1 - m.r;
                mDrawC = CONSTANTS.COLS - 1 - m.c;
            }
            ctx.fillRect(mDrawC * CONSTANTS.TILE_SIZE, mDrawR * CONSTANTS.TILE_SIZE, CONSTANTS.TILE_SIZE, CONSTANTS.TILE_SIZE);
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
                let r = item.r, c = item.c;
                if (rotate) {
                    r = CONSTANTS.ROWS - 1 - r;
                    c = CONSTANTS.COLS - 1 - c;
                }
                ctx.strokeRect(c * CONSTANTS.TILE_SIZE, r * CONSTANTS.TILE_SIZE, CONSTANTS.TILE_SIZE, CONSTANTS.TILE_SIZE);
            });

            // Reset Shadow
            ctx.shadowBlur = 0;

            // Highlight Victims (Pulsing Red)
            eq.removed.forEach(item => {
                let r = item.r, c = item.c;
                if (rotate) {
                    r = CONSTANTS.ROWS - 1 - r;
                    c = CONSTANTS.COLS - 1 - c;
                }

                const x = c * CONSTANTS.TILE_SIZE;
                const y = r * CONSTANTS.TILE_SIZE;

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
                let drawR = r;
                let drawC = c;
                if (rotate) {
                    drawR = CONSTANTS.ROWS - 1 - r;
                    drawC = CONSTANTS.COLS - 1 - c;
                }

                const x = drawC * CONSTANTS.TILE_SIZE + CONSTANTS.TILE_SIZE / 2;
                const y = drawR * CONSTANTS.TILE_SIZE + CONSTANTS.TILE_SIZE / 2;

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
