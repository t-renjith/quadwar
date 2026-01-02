import { GameLogic } from './logic.js';
import { CONSTANTS } from './constants.js';

console.log('--- STARTING 2-TERM TEST ---');

const game = new GameLogic();

function clearBoard() {
    for (let r = 0; r < 9; r++) for (let c = 0; c < 8; c++) game.board[r][c] = null;
}

function setPiece(r, c, type, val, player) {
    game.board[r][c] = {
        type: type,
        value: val,
        player: player,
        label: val
    };
}

// Test: 2-Term Equation
// 3x^2 + 2x = 0 (Requires specific values, but let's try something that zeros out nicely)
// e.g. 1x^2 + 0x = 0 (a=1, b=0, c=0). D=0. Real.
// Setup: Red 1x^2, Blue 0x.
console.log('Test 4: 2-Term Equation (1x^2 + 0x = 0)');
clearBoard();
setPiece(4, 3, CONSTANTS.TYPE_QUADRATIC, 1, CONSTANTS.PLAYER_RED);
setPiece(4, 4, CONSTANTS.TYPE_LINEAR, 0, CONSTANTS.PLAYER_BLUE);

game.currentPlayer = CONSTANTS.PLAYER_RED;
const res2Term = game.resolveEquations(4, 4);

if (res2Term.length > 0) {
    console.log("PASS: 2-Term Equation Found: " + res2Term[0].equation);
} else {
    console.error("FAIL: 2-Term Equation NOT Found.");
}

console.log('--- TEST COMPLETE ---');
