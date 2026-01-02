document.addEventListener('DOMContentLoaded', () => {
    const playBtn = document.getElementById('playBtn');
    const modalOverlay = document.getElementById('modalOverlay');
    const closeModal = document.getElementById('closeModal');
    const modeButtons = document.querySelectorAll('.mode-btn');

    // Open Modal
    playBtn.addEventListener('click', () => {
        modalOverlay.classList.add('active');
    });

    // Close Modal on clicking outside
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            modalOverlay.classList.remove('active');
        }
    });

    // Handle Mode Selection
    modeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.dataset.mode;
            navigateToGame(mode);
        });
    });

    function navigateToGame(mode) {
        window.location.href = `game.html?mode=${mode}`;
    }

    // Add some random floating equations for background
    createBackgroundElements();
});

function createBackgroundElements() {
    const equations = ['x² - 4 = 0', '2x + 1 = 5', 'y = mx + b', 'Δ = b² - 4ac', 'f(x)', 'x → ∞'];
    const container = document.body;
    
    for(let i = 0; i < 15; i++) {
        const el = document.createElement('div');
        el.className = 'equation-bg';
        el.textContent = equations[Math.floor(Math.random() * equations.length)];
        
        // Random position
        el.style.left = `${Math.random() * 100}vw`;
        el.style.top = `${Math.random() * 100}vh`;
        el.style.opacity = Math.random() * 0.1;
        el.style.transform = `rotate(${Math.random() * 40 - 20}deg)`;
        
        container.appendChild(el);
    }
}
