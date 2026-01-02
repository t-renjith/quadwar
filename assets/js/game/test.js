import { GameLogic } from './logic.js';
import { CONSTANTS } from './constants.js';

console.log('--- STARTING TESTS ---');

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

console.log('Test 1: Linear Movement');
clearBoard();
setPiece(4, 4, CONSTANTS.TYPE_LINEAR, 1, CONSTANTS.PLAYER_RED);
game.currentPlayer = CONSTANTS.PLAYER_RED;
const moves = game.getValidMoves(4, 4);
if (moves.length === 8) console.log("PASS: Linear moves correct.");
else console.error("FAIL: Linear moves incorrect.");

console.log('Test 2: Equation [Real Roots]');
clearBoard();
// x^2 - 4 = 0
setPiece(4, 3, CONSTANTS.TYPE_QUADRATIC, 1, CONSTANTS.PLAYER_RED);
setPiece(4, 4, CONSTANTS.TYPE_LINEAR, 0, CONSTANTS.PLAYER_BLUE);
setPiece(4, 5, CONSTANTS.TYPE_CONSTANT, -4, CONSTANTS.PLAYER_RED);
game.currentPlayer = CONSTANTS.PLAYER_RED;
const res1 = game.resolveEquations(4, 5);
if (res1.length > 0 && res1[0].realRoots) console.log("PASS: Real Roots detected.");
else console.error("FAIL: Real Roots NOT detected.");

console.log('Test 3: Equation [No Quadratic Term]');
clearBoard();
// 2x - 2x + 0 = 0 (Linear equation, should be IGNORED now)
setPiece(4, 3, CONSTANTS.TYPE_LINEAR, 2, CONSTANTS.PLAYER_RED);
setPiece(4, 4, CONSTANTS.TYPE_LINEAR, -2, CONSTANTS.PLAYER_BLUE);
setPiece(4, 5, CONSTANTS.TYPE_CONSTANT, 0, CONSTANTS.PLAYER_RED);
game.currentPlayer = CONSTANTS.PLAYER_RED;
const resLin = game.resolveEquations(4, 5);
if (resLin.length === 0) console.log("PASS: Linear-only equation IGNORED.");
else console.error("FAIL: Linear-only equation was detected! " + resLin[0].equation);

console.log('--- TESTS COMPLETE ---');
