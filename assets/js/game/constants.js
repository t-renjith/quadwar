export const CONSTANTS = {
    ROWS: 9,
    COLS: 8,
    TILE_SIZE: 70, // Pixel size for rendering
    PLAYER_RED: 1,
    PLAYER_BLUE: 2,

    // Piece Types
    TYPE_QUADRATIC: 'quad', // ax^2
    TYPE_LINEAR: 'lin',     // bx
    TYPE_CONSTANT: 'const', // c

    // Colors
    COLOR_BG: '#121212',
    COLOR_GRID: '#2a2a2a',
    COLOR_BOARD_LIGHT: '#25252a',
    COLOR_BOARD_DARK: '#16161a',
    COLOR_RED: '#ff3366',
    COLOR_BLUE: '#00ccff',
    COLOR_HIGHLIGHT: 'rgba(255, 255, 255, 0.2)',
    COLOR_VALID_MOVE: 'rgba(0, 255, 0, 0.3)',

    // Initial Board Setup
    // Values are mirrored for Player 2
    // Row 0/8: Quadratic (-4 to 4)
    // Row 1/7: Linear (-4 to 4)
    // Row 2/6: Constant (-4 to 4)
    INITIAL_TERMS: {
        QUAD: [-4, -3, -2, -1, 1, 2, 3, 4],
        LIN: [-4, -3, -2, -1, 1, 2, 3, 4],
        CONST: [-4, -3, -2, -1, 1, 2, 3, 4]
    }
};
