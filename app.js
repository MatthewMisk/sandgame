document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('sand-canvas');
    if (!canvas) return; // Safety Check
    
    const ctx = canvas.getContext('2d');
    const btnStart = document.getElementById('btn-start');
    const btnReset = document.getElementById('btn-reset');
    const menuContainer = document.getElementById('menu-container');
    const btnToggleMenu = document.getElementById('btn-toggle-menu');
    const actionMenu = document.getElementById('action-menu');
    
    const btnModeAdd = document.getElementById('btn-mode-add');
    const btnModeRemove = document.getElementById('btn-mode-remove');
    const btnModePlay = document.getElementById('btn-mode-play');

    // Physics Constants
    const MAX_PARTICLES = 30000; // <--- CHANGED: Raised limit for massive amounts of sand
    const PARTICLE_RADIUS = 2;
    const GRID_SIZE = PARTICLE_RADIUS * 2;
    
    let particles =[];
    let gridCols, gridRows;
    let head, next; // Flat spatial hash arrays
    
    let gravity = { x: 0, y: 1 };
    let currentMode = 'PLAY';
    let pointer = { x: 0, y: 0, active: false };
    let isRunning = false;

    class Particle {
        constructor(x, y) {
            this.x = x;
            this.y = y;
            this.vx = (Math.random() - 0.5);
            this.vy = (Math.random() - 0.5);
        }
    }

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        gridCols = Math.ceil(canvas.width / GRID_SIZE);
        gridRows = Math.ceil(canvas.height / GRID_SIZE);
        head = new Int32Array(gridCols * gridRows);
        next = new Int32Array(MAX_PARTICLES);
    }
    window.addEventListener('resize', resize);
    resize();

    function spawnInitialSand() {
        particles =[];
        for (let i = 0; i < 2000; i++) {
            particles.push(new Particle(
                canvas.width / 2 + (Math.random() - 0.5) * 150, 
                canvas.height / 2 + (Math.random() - 0.5) * 150
            ));
        }
    }

    function removeParticle(index) {
        if (index >= 0 && index < particles.length) {
            // Swap with last element and pop to avoid O(N) splice shifting
            particles[index] = particles[particles.length - 1];
            particles.pop();
        }
    }

    function updatePhysics() {
        head.fill(-1);

        // 1. Apply Forces & Populate Spatial Hash
        for (let i = 0; i < particles.length; i++) {
            let p = particles[i];
            
            p.vx += gravity.x * 0.4;
            p.vy += gravity.y * 0.4;
            
            p.vx *= 0.96; // Friction
            p.vy *= 0.96;
            
            p.x += p.vx;
            p.y += p.vy;
            
            // Boundary constraints
            if (p.x < PARTICLE_RADIUS) { p.x = PARTICLE_RADIUS; p.vx *= -0.3; }
            else if (p.x > canvas.width - PARTICLE_RADIUS) { p.x = canvas.width - PARTICLE_RADIUS; p.vx *= -0.3; }
            
            if (p.y < PARTICLE_RADIUS) { p.y = PARTICLE_RADIUS; p.vy *= -0.3; }
            else if (p.y > canvas.height - PARTICLE_RADIUS) { p.y = canvas.height - PARTICLE_RADIUS; p.vy *= -0.3; }
            
            // Hash position
            let col = Math.max(0, Math.min(gridCols - 1, Math.floor(p.x / GRID_SIZE)));
            let row = Math.max(0, Math.min(gridRows - 1, Math.floor(p.y / GRID_SIZE)));
            let cellIdx = row * gridCols + col;
            
            next[i] = head[cellIdx];
            head[cellIdx] = i;
        }

        // 2. Resolve Collisions
        for (let i = 0; i < particles.length; i++) {
            let p1 = particles[i];
            let col = Math.max(0, Math.min(gridCols - 1, Math.floor(p1.x / GRID_SIZE)));
            let row = Math.max(0, Math.min(gridRows - 1, Math.floor(p1.y / GRID_SIZE)));
            
            for (let dRow = -1; dRow <= 1; dRow++) {
                for (let dCol = -1; dCol <= 1; dCol++) {
                    let nRow = row + dRow;
                    let nCol = col + dCol;
                    
                    if (nRow >= 0 && nRow < gridRows && nCol >= 0 && nCol < gridCols) {
                        let cellIdx = nRow * gridCols + nCol;
                        let j = head[cellIdx];
                        
                        while (j !== -1) {
                            if (i < j) { // Check each pair only once
                                let p2 = particles[j];
                                let dx = p2.x - p1.x;
                                let dy = p2.y - p1.y;
                                let distSq = dx * dx + dy * dy;
                                let minDist = PARTICLE_RADIUS * 2;
                                
                                if (distSq < minDist * minDist && distSq > 0) {
                                    let dist = Math.sqrt(distSq);
                                    let overlap = minDist - dist;
                                    let nx = dx / dist;
                                    let ny = dy / dist;
                                    
                                    let pushX = nx * overlap * 0.5;
                                    let pushY = ny * overlap * 0.5;
                                    
                                    p1.x -= pushX; p1.y -= pushY;
                                    p2.x += pushX; p2.y += pushY;
                                    
                                    p1.vx -= pushX * 0.5; p1.vy -= pushY * 0.5;
                                    p2.vx += pushX * 0.5; p2.vy += pushY * 0.5;
                                }
                            }
                            j = next[j];
                        }
                    }
                }
            }
        }

        // 3. Pointer Interactions
        if (pointer.active) {
            if (currentMode === 'ADD') {
                for (let i = 0; i < 5; i++) {
                    if (particles.length < MAX_PARTICLES) {
                        particles.push(new Particle(pointer.x + (Math.random()-0.5)*10, pointer.y + (Math.random()-0.5)*10));
                    }
                }
            } else if (currentMode === 'REMOVE') {
                for (let i = particles.length - 1; i >= 0; i--) {
                    let p = particles[i];
                    let dx = p.x - pointer.x;
                    let dy = p.y - pointer.y;
                    if (dx * dx + dy * dy < 1600) { // 40px radius
                        removeParticle(i);
                    }
                }
            } else if (currentMode === 'PLAY') {
                for (let i = 0; i < particles.length; i++) {
                    let p = particles[i];
                    let dx = p.x - pointer.x;
                    let dy = p.y - pointer.y;
                    let distSq = dx * dx + dy * dy;
                    if (distSq < 3600) { // 60px radius
                        let dist = Math.sqrt(distSq);
                        p.vx += (dx / dist) * 1.5;
                        p.vy += (dy / dist) * 1.5;
                    }
                }
            }
        }
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw all particles efficiently in one path
        ctx.fillStyle = '#e0c090'; // Sand color
        ctx.beginPath();
        for (let i = 0; i < particles.length; i++) {
            let p = particles[i];
            ctx.rect(p.x - PARTICLE_RADIUS, p.y - PARTICLE_RADIUS, PARTICLE_RADIUS * 2, PARTICLE_RADIUS * 2);
        }
        ctx.fill();
    }

    function loop() {
        if (!isRunning) return;
        updatePhysics();
        draw();
        requestAnimationFrame(loop);
    }

    // --- Device Orientation ---
    function handleOrientation(e) {
        let beta = Math.max(-90, Math.min(90, e.beta || 0)); // Front/Back
        let gamma = Math.max(-90, Math.min(90, e.gamma || 0)); // Left/Right
        
        // Normalize to -1 to 1
        gravity.x = gamma / 90;
        gravity.y = beta / 90;
        
        // Fallback for flat surfaces to keep sand resting
        if (Math.abs(gravity.x) < 0.05 && Math.abs(gravity.y) < 0.05) {
            gravity.y = 0.1; 
        }
    }

    btnStart.addEventListener('click', async () => {
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            try {
                const permission = await DeviceOrientationEvent.requestPermission();
                if (permission === 'granted') {
                    window.addEventListener('deviceorientation', handleOrientation);
                }
            } catch (err) {
                console.error("Sensor permission denied", err);
            }
        } else {
            window.addEventListener('deviceorientation', handleOrientation);
        }
        
        btnStart.classList.add('hidden');
        btnReset.classList.remove('hidden');
        menuContainer.classList.remove('hidden');
        
        spawnInitialSand();
        isRunning = true;
        requestAnimationFrame(loop);
    });

    btnReset.addEventListener('click', () => {
        particles =[];
    });

    // --- Pointer Events ---
    canvas.addEventListener('pointerdown', (e) => {
        pointer.active = true;
        pointer.x = e.clientX;
        pointer.y = e.clientY;
    });
    canvas.addEventListener('pointermove', (e) => {
        pointer.x = e.clientX;
        pointer.y = e.clientY;
    });
    window.addEventListener('pointerup', () => pointer.active = false);
    window.addEventListener('pointercancel', () => pointer.active = false);

    // --- UI Menu Logic ---
    let menuTimeout;
    
    function resetMenuTimeout() {
        clearTimeout(menuTimeout);
        menuTimeout = setTimeout(() => {
            actionMenu.classList.add('hidden');
        }, 3000);
    }

    btnToggleMenu.addEventListener('click', () => {
        actionMenu.classList.toggle('hidden');
        if (!actionMenu.classList.contains('hidden')) {
            resetMenuTimeout();
        }
    });

    const modeBtns =[btnModeAdd, btnModeRemove, btnModePlay];
    function setMode(mode, btn) {
        currentMode = mode;
        modeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        resetMenuTimeout();
    }

    btnModeAdd.addEventListener('click', () => setMode('ADD', btnModeAdd));
    btnModeRemove.addEventListener('click', () => setMode('REMOVE', btnModeRemove));
    btnModePlay.addEventListener('click', () => setMode('PLAY', btnModePlay));
});