document.addEventListener('DOMContentLoaded', () => {
    let score = 0; // Positive = White winning, Negative = Black winning
    let activeTransition = null; // Track view transitions to prevent InvalidStateError

    // Helper to safely execute view transitions without throwing errors
    function safeViewTransition(callback) {
        if (!document.startViewTransition || activeTransition) {
            callback();
            return;
        }
        try {
            activeTransition = document.startViewTransition(() => {
                callback();
            });
            activeTransition.finished.finally(() => {
                activeTransition = null;
            }).catch(() => {});
        } catch (e) {
            callback();
        }
    }
    
    // DOM Elements
    const whiteFill = document.getElementById('white-fill');
    const blackFill = document.getElementById('black-fill');
    const advantageValue = document.getElementById('advantage-value');
    const advantageIndicator = document.querySelector('.advantage-indicator');
    
    const whiteCaptured = document.getElementById('white-captured');
    const blackCaptured = document.getElementById('black-captured');
    
    const captureBtns = document.querySelectorAll('.capture-btn');
    const resetBtn = document.getElementById('reset-btn');
    const themeToggleBtn = document.getElementById('theme-toggle');

    // Player Name Input Logic
    const playerNames = document.querySelectorAll('.player-name');
    playerNames.forEach(nameEl => {
        nameEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                nameEl.blur(); // Remove focus to exit editing mode
            }
        });
    });

    // Theme Toggle Logic
    let isLightMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
    
    // Auto-apply initial system theme
    if (isLightMode) {
        document.documentElement.setAttribute('data-theme', 'light');
        const icon = themeToggleBtn.querySelector('i');
        if (icon) {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
        }
    }

    // Auto-sync theme with OS if in mobile layout
    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', e => {
            if (document.body.classList.contains('mobile-layout')) {
                isLightMode = e.matches;
                toggleTheme(themeToggleBtn.querySelector('i'));
            }
        });
    }

    themeToggleBtn.addEventListener('click', (e) => {
        isLightMode = !isLightMode;
        
        const icon = themeToggleBtn.querySelector('i');
        // Nice rotation animation
        icon.style.transform = `rotate(${isLightMode ? 360 : 0}deg)`;

        // --- Coordinate Transformation Engine ---
        const isMobileTouch = window.matchMedia('(pointer: coarse)').matches;
        const isPortrait = isMobileTouch && window.innerHeight > window.innerWidth;
        const logicalX = isPortrait ? e.clientY : e.clientX;
        const logicalY = isPortrait ? (window.innerWidth - e.clientX) : e.clientY;

        // Check if View Transitions API is supported
        if (!document.startViewTransition) {
            // --- BULLETPROOF DOM FALLBACK FOR OLDER BROWSERS ---
            const overlay = document.createElement('div');
            overlay.className = 'theme-fallback-overlay';
            
            // Apply the upcoming background so it looks like the new theme expanding
            const nextBg = isLightMode 
                ? 'radial-gradient(circle at top right, #f4f4f9 0%, #e0e0e0 100%)' 
                : 'radial-gradient(circle at center, #1a1a2e 0%, #0a0a0f 100%)';
            
            overlay.style.background = nextBg;
            overlay.style.left = `${logicalX}px`;
            overlay.style.top = `${logicalY}px`;
            document.body.appendChild(overlay);

            // Force reflow
            void overlay.offsetWidth;
            
            // Start expansion
            overlay.classList.add('expand');
            
            // Flip the actual DOM theme halfway through the expansion
            setTimeout(() => {
                toggleTheme(icon);
            }, 1250);

            // Fade out and remove the overlay once it covers the screen
            setTimeout(() => {
                overlay.style.opacity = '0';
                setTimeout(() => overlay.remove(), 800);
            }, 2500);
            
            return;
        }

        // Set CSS variables for the click position so pure CSS can handle the circular reveal
        document.documentElement.style.setProperty('--click-x', `${logicalX}px`);
        document.documentElement.style.setProperty('--click-y', `${logicalY}px`);

        // Add a class so CSS knows we are doing a theme wipe
        document.documentElement.classList.add('theme-transitioning');

        safeViewTransition(() => {
            toggleTheme(icon);
        });

        // The safeViewTransition wrapper handles the callback instantly or via the API,
        // but we need to ensure the class is removed. We can just use a timeout fallback
        // since the actual transition promise is abstracted.
        setTimeout(() => {
            document.documentElement.classList.remove('theme-transitioning');
        }, 1000);
    });

    function toggleTheme(icon) {
        document.documentElement.setAttribute('data-theme', isLightMode ? 'light' : 'dark');
        if (isLightMode) {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
        } else {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        }
    }

    // Promotion Trigger Logic
    const promoteTriggers = document.querySelectorAll('.promote-trigger');
    promoteTriggers.forEach(trigger => {
        trigger.addEventListener('click', (e) => {
            const container = e.currentTarget.closest('.promotion-container');
            container.classList.toggle('active');
        });
    });

    // Capture Piece Logic
    function handleCaptureClick(e) {
        const btn = e.currentTarget;
        const piece = btn.getAttribute('data-piece');
        const value = parseInt(btn.getAttribute('data-value'), 10);
        const player = btn.getAttribute('data-player'); // 'white' or 'black'
        const iconClass = btn.querySelector('i').className;
        
        // --- PROMOTION MENU INTERCEPT ---
        if (piece.startsWith('promo-')) {
            // Hide the pop-up menu after selection
            const container = btn.closest('.promotion-container');
            container.classList.remove('active');
            
            // Create a brand new physical button in the container
            const realPiece = piece.replace('promo-', '');
            const newBtn = document.createElement('button');
            newBtn.className = `capture-btn ${player === 'white' ? 'white-action' : 'black-action'} promoted-piece-btn`;
            newBtn.setAttribute('data-player', player);
            newBtn.setAttribute('data-piece', realPiece);
            newBtn.setAttribute('data-value', value);
            newBtn.setAttribute('data-max-clicks', '1'); // Promoted pieces can only be captured once
            newBtn.title = `Capture Promoted ${realPiece.charAt(0).toUpperCase() + realPiece.slice(1)}`;
            newBtn.innerHTML = `<i class="${iconClass}"></i>`;
            
            newBtn.addEventListener('click', handleCaptureClick);
            
            // Start it visually collapsed
            newBtn.style.width = '0px';
            newBtn.style.margin = '0px';
            newBtn.style.padding = '0px';
            newBtn.style.transform = 'scale(0)';
            newBtn.style.opacity = '0';
            newBtn.style.overflow = 'hidden';
            newBtn.style.transition = 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
            
            // Insert it right before the + button
            container.parentNode.insertBefore(newBtn, container);
            
            // Fluidly expand it
            requestAnimationFrame(() => {
                newBtn.style.width = '';
                newBtn.style.margin = '';
                newBtn.style.padding = '';
                newBtn.style.transform = '';
                newBtn.style.opacity = '';
            });
            
            // Track total promotions. Max 8 total across all types per player.
            let totalPromos = parseInt(container.getAttribute('data-total-promos') || '0', 10);
            totalPromos++;
            container.setAttribute('data-total-promos', totalPromos);
            
            if (totalPromos >= 8) {
                container.style.transition = 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
                container.style.overflow = 'hidden';
                container.style.opacity = '0';
                container.style.transform = 'scale(0)';
                container.style.width = '0px';
                container.style.margin = '0px';
                container.style.padding = '0px';
                setTimeout(() => container.style.display = 'none', 300);
            }
            
            // We exit here because a piece wasn't captured, a new target was just generated!
            return;
        }
        
        // --- STANDARD CAPTURE LOGIC ---
        let clicks = parseInt(btn.getAttribute('data-clicks') || '0', 10);
        let maxClicks = parseInt(btn.getAttribute('data-max-clicks'), 10);
        if (isNaN(maxClicks)) {
            maxClicks = 2; // Default for Rook, Knight, Bishop
            if (piece === 'pawn') maxClicks = 8;
            if (piece === 'queen') maxClicks = 1;
        }
        
        // Prevent action if already fully exhausted
        if (clicks >= maxClicks) return;
        
        capturePiece(player, piece, value, iconClass, btn);
        
        // Standard button click limits
        clicks++;
        btn.setAttribute('data-clicks', clicks);
        
        if (clicks >= maxClicks) {
            btn.style.transition = 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
            btn.style.overflow = 'hidden';
            btn.style.opacity = '0';
            btn.style.transform = 'scale(0)';
            btn.style.width = '0px';
            btn.style.margin = '0px';
            btn.style.padding = '0px';
            
            if (clicks === maxClicks) {
                const opponent = player === 'white' ? 'PLAYER 2' : 'PLAYER 1';
                let opponentName = '';
                if (player === 'white') {
                    opponentName = document.querySelector('.right-panel .player-name').textContent.trim();
                } else {
                    opponentName = document.querySelector('.left-panel .player-name').textContent.trim();
                }
                showCentralPopup(opponentName.toUpperCase(), piece.toUpperCase(), iconClass);
            }
            
            setTimeout(() => {
                btn.style.display = 'none';
            }, 300);
        }
        
        // Automatically pass the turn after a successful capture
        switchTurn(player);
    }

    const captureBtnsNonPromo = document.querySelectorAll('.capture-btn:not(.promote-trigger)');
    captureBtnsNonPromo.forEach(btn => {
        btn.addEventListener('click', handleCaptureClick);
    });

    function capturePiece(player, piece, value, iconClass, sourceBtn) {
        // Create piece element
        const pieceEl = document.createElement('i');
        pieceEl.className = iconClass;
        pieceEl.style.cursor = 'pointer';
        pieceEl.title = 'Tap to undo';
        
        // --- Tap to Undo Logic ---
        pieceEl.addEventListener('click', () => {
            // 1. Revert Score
            if (player === 'white') score -= value;
            else score += value;
            
            // 2. Animate removal
            pieceEl.style.transition = 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
            pieceEl.style.opacity = '0';
            pieceEl.style.transform = 'scale(0)';
            setTimeout(() => pieceEl.remove(), 200);
            
            // 3. Restore the exhausted button
            if (sourceBtn) {
                let clicks = parseInt(sourceBtn.getAttribute('data-clicks') || '0', 10);
                if (clicks > 0) clicks--;
                sourceBtn.setAttribute('data-clicks', clicks);
                
                if (sourceBtn.style.display === 'none' || sourceBtn.style.opacity === '0') {
                    sourceBtn.style.display = '';
                    setTimeout(() => {
                        sourceBtn.style.opacity = '';
                        sourceBtn.style.transform = '';
                        sourceBtn.style.width = '';
                        sourceBtn.style.margin = '';
                        sourceBtn.style.padding = '';
                        sourceBtn.style.overflow = '';
                    }, 10);
                }
            }
            
            updateAdvantageUI();
            triggerPulse();
        });
        
        // Add to captured area and update score
        if (player === 'white') {
            whiteCaptured.appendChild(pieceEl);
            score += value;
        } else {
            blackCaptured.appendChild(pieceEl);
            score -= value;
        }

        updateAdvantageUI();
        triggerPulse();
    }
    
    // --- Central Elimination Popup Logic ---
    let centralPopupTimeout;
    function showCentralPopup(opponentName, pieceName, iconClass) {
        const popup = document.getElementById('central-popup');
        const iconEl = popup.querySelector('i');
        const textEl = popup.querySelector('span');
        
        iconEl.className = iconClass;
        textEl.textContent = `${opponentName}'S ${pieceName} HAS BEEN ELIMINATED COMPLETELY`;
        
        popup.classList.add('show');
        
        clearTimeout(centralPopupTimeout);
        // Keep it visible for 4.5 seconds so the user can read the grand message
        centralPopupTimeout = setTimeout(() => {
            popup.classList.remove('show');
        }, 4500);
    }

    function updateAdvantageUI() {
        // Update number
        advantageValue.textContent = Math.abs(score) === 0 ? '=' : `+${Math.abs(score)}`;
        
        // Max advantage considered for 100% bar width is roughly 39 (max possible material)
        // We'll cap the visual at 20 for better sensitivity.
        const MAX_VISUAL_SCORE = 20;
        let percentage = Math.abs(score) / MAX_VISUAL_SCORE; 
        if (percentage > 1) percentage = 1;
        
        if (score > 0) {
            // White is winning
            whiteFill.style.transform = `scaleX(${percentage})`;
            blackFill.style.transform = 'scaleX(0)';
        } else if (score < 0) {
            // Black is winning
            whiteFill.style.transform = 'scaleX(0)';
            blackFill.style.transform = `scaleX(${percentage})`;
        } else {
            // Tie
            whiteFill.style.transform = 'scaleX(0)';
            blackFill.style.transform = 'scaleX(0)';
        }
    }

    function triggerPulse() {
        advantageIndicator.classList.remove('pulse');
        // Trigger reflow
        void advantageIndicator.offsetWidth;
        advantageIndicator.classList.add('pulse');
    }

    // Reset Logic
    resetBtn.addEventListener('click', () => {
        // Trigger a premium smooth blur and fade reset animation
        document.body.classList.add('page-reset-anim');
        
        // Reset the actual game state at the exact halfway point (when opacity is 0)
        setTimeout(() => {
            score = 0;
            whiteCaptured.innerHTML = '';
            blackCaptured.innerHTML = '';
            updateAdvantageUI();
            
            // Restore any hidden capture buttons or promotion containers
            captureBtnsNonPromo.forEach(btn => {
                btn.setAttribute('data-clicks', '0');
                btn.style.display = '';
                btn.style.opacity = '';
                btn.style.transform = '';
                btn.style.width = '';
                btn.style.margin = '';
                btn.style.padding = '';
                btn.style.overflow = '';
            });
            
            // Destroy dynamically generated promoted buttons
            document.querySelectorAll('.promoted-piece-btn').forEach(btn => btn.remove());
            
            const promoContainers = document.querySelectorAll('.promotion-container');
            promoContainers.forEach(container => {
                container.setAttribute('data-total-promos', '0');
                container.classList.remove('active');
                container.style.display = '';
                container.style.opacity = '';
                container.style.transform = '';
                container.style.width = '';
                container.style.margin = '';
                container.style.padding = '';
                container.style.overflow = '';
            });

            // Reset Timer Engine and return to selection screen
            if (typeof isGameActive !== 'undefined') {
                isGameActive = false;
                clearInterval(timerInterval);
                
                whiteClockEl.textContent = '--:--';
                blackClockEl.textContent = '--:--';
                whiteClockEl.classList.remove('active', 'low-time');
                blackClockEl.classList.remove('active', 'low-time');
                
                timerOverlay.style.display = 'flex';
                // Slight delay to allow DOM to register 'display: flex' before animating opacity
                setTimeout(() => timerOverlay.classList.remove('hidden'), 10);
            }
        }, 600); 

        // Remove the animation class once the entire sequence completes
        setTimeout(() => {
            document.body.classList.remove('page-reset-anim');
        }, 1200);
    });

    // --- Fluid Orientation/Resize Animation Logic ---
    const checkLayout = () => {
        // Apply mobile layout if the window is narrow.
        const isNarrow = window.innerWidth <= 1024;
        const currentlyMobile = document.body.classList.contains('mobile-layout');

        if (isNarrow !== currentlyMobile) {
            safeViewTransition(() => {
                document.body.classList.toggle('mobile-layout', isNarrow);
            });
        }
    };

    // Run immediately and bind unconditionally
    checkLayout();
    window.addEventListener('resize', checkLayout);

    // --- Radial Gesture Menu Engine ---
    let radialHoldTimer = null;
    let isRadialActive = false;
    let radialCenter = { x: 0, y: 0 };
    let radialStartPos = { x: 0, y: 0 };
    let radialActivePlayer = null;
    let highlightedRadialItem = null;

    const radialMenuEl = document.getElementById('radial-menu');
    const radialCenterEl = document.getElementById('radial-center');
    
    const radialPiecesData = [
        { id: 'queen', icon: 'fa-chess-queen' },
        { id: 'rook', icon: 'fa-chess-rook' },
        { id: 'bishop', icon: 'fa-chess-bishop' },
        { id: 'knight', icon: 'fa-chess-knight' },
        { id: 'pawn', icon: 'fa-chess-pawn' }
    ];

    function activateRadialMenu(centerX, centerY) {
        isRadialActive = true;
        radialCenter = { x: centerX, y: centerY };
        radialCenterEl.style.left = `${centerX}px`;
        radialCenterEl.style.top = `${centerY}px`;
        radialCenterEl.innerHTML = '';
        radialMenuEl.classList.add('active');
        
        radialPiecesData.forEach((piece, index) => {
            // Spread evenly in a 360 circle
            const angle = (index * (360 / radialPiecesData.length)) - 90;
            const rad = angle * (Math.PI / 180);
            
            // Mathematically responsive radius: Calculate how close the center is to the screen edges
            const minEdgeDist = Math.min(
                centerY, 
                window.innerHeight - centerY, 
                centerX, 
                window.innerWidth - centerX
            );
            
            // Assume the item itself takes up ~30px radius + 10px breathing room.
            // Cap the maximum spread to 110px, but squish it down automatically if near an edge.
            let responsiveRadius = Math.min(110, minEdgeDist - 40);
            
            // Set an absolute minimum spread so it doesn't collapse entirely on tiny screens
            if (responsiveRadius < 65) responsiveRadius = 65; 
            
            const finalX = Math.cos(rad) * responsiveRadius;
            const finalY = Math.sin(rad) * responsiveRadius;
            
            // Check exhaustion directly from DOM buttons
            let isExhausted = false;
            const btn = document.querySelector(`.capture-btn[data-player="${radialActivePlayer}"][data-piece="${piece.id}"]`);
            if (!btn || btn.style.display === 'none') {
                isExhausted = true;
            }
            
            const item = document.createElement('div');
            item.className = `radial-item ${isExhausted ? 'disabled' : ''}`;
            item.setAttribute('data-piece', piece.id);
            item.innerHTML = `<i class="fa-solid ${piece.icon}"></i>`;
            
            // Store target coordinates in CSS vars so the hover animation scale matches
            item.style.setProperty('--final-x', `${finalX}px`);
            item.style.setProperty('--final-y', `${finalY}px`);
            
            radialCenterEl.appendChild(item);
            
            // Trigger animation
            requestAnimationFrame(() => {
                item.style.transform = `translate(${finalX}px, ${finalY}px) scale(1)`;
            });
        });
    }

    function cancelRadialTimer() {
        if (radialHoldTimer) {
            clearTimeout(radialHoldTimer);
            radialHoldTimer = null;
        }
    }

    function closeRadialMenu() {
        isRadialActive = false;
        highlightedRadialItem = null;
        radialMenuEl.classList.remove('active');
        const items = radialCenterEl.querySelectorAll('.radial-item');
        items.forEach(item => {
            item.style.transform = `translate(0, 0) scale(0)`;
        });
        setTimeout(() => {
            if (!isRadialActive) radialCenterEl.innerHTML = '';
        }, 200);
    }

    function updateRadialSelection(x, y) {
        if (!isRadialActive) return;
        
        highlightedRadialItem = null;
        let minDist = Infinity;
        const items = radialCenterEl.querySelectorAll('.radial-item:not(.disabled)');
        
        items.forEach(item => {
            item.classList.remove('active-hover');
            
            const rect = item.getBoundingClientRect();
            const itemX = rect.left + rect.width / 2;
            const itemY = rect.top + rect.height / 2;
            
            const dist = Math.hypot(x - itemX, y - itemY);
            if (dist < minDist) {
                minDist = dist;
                highlightedRadialItem = item;
            }
        });
        
        // Highlight closest item if within dragging threshold
        if (minDist < 90 && highlightedRadialItem) {
            highlightedRadialItem.classList.add('active-hover');
        } else {
            highlightedRadialItem = null;
        }
    }

    function executeRadialSelection() {
        if (highlightedRadialItem) {
            const pieceId = highlightedRadialItem.getAttribute('data-piece');
            const btn = document.querySelector(`.capture-btn[data-player="${radialActivePlayer}"][data-piece="${pieceId}"]`);
            if (btn && btn.style.display !== 'none') {
                btn.click(); // Fires standard capture
            }
        }
    }

    // Bind hold gesture to avatars
    const avatars = document.querySelectorAll('.player-avatar.large-avatar');
    avatars.forEach(avatar => {
        avatar.addEventListener('pointerdown', (e) => {
            if (e.button !== 0 && e.pointerType === 'mouse') return; // Ignore right clicks
            
            const logicalX = e.clientX;
            const logicalY = e.clientY;
            
            radialStartPos = { x: logicalX, y: logicalY };
            radialActivePlayer = avatar.classList.contains('white-player') ? 'white' : 'black';
            
            radialHoldTimer = setTimeout(() => {
                radialHoldTimer = null; // Clear timer reference once activated
                
                // Calculate absolute mathematical center of the avatar icon (Physical space)
                const rect = avatar.getBoundingClientRect();
                const physCenterX = rect.left + rect.width / 2;
                const physCenterY = rect.top + rect.height / 2;
                
                // Use physical center directly since we no longer rotate the screen
                const logicalCenterX = physCenterX;
                const logicalCenterY = physCenterY;
                
                activateRadialMenu(logicalCenterX, logicalCenterY);
            }, 350); // 350ms delay
        });
        
        // Only cancel the hold timer on early leave/cancel. Do NOT close the active menu here.
        avatar.addEventListener('pointerup', (e) => {
            if (radialHoldTimer) {
                // The timer is still running, which means this was a quick TAP, not a HOLD!
                clearTimeout(radialHoldTimer);
                radialHoldTimer = null;
                
                // Pass turn if it's this player's active turn
                const tappedPlayer = avatar.classList.contains('white-player') ? 'white' : 'black';
                if (activeTimer === tappedPlayer) {
                    switchTurn(tappedPlayer);
                }
            }
        });
        avatar.addEventListener('pointerleave', cancelRadialTimer);
        avatar.addEventListener('pointercancel', cancelRadialTimer);
    });

    window.addEventListener('pointermove', (e) => {
        const logicalX = e.clientX;
        const logicalY = e.clientY;

        if (isRadialActive) {
            e.preventDefault(); // Stop screen from scrolling
            updateRadialSelection(logicalX, logicalY);
        } else if (radialHoldTimer) {
            const dist = Math.hypot(logicalX - radialStartPos.x, logicalY - radialStartPos.y);
            if (dist > 15) cancelRadialTimer(); // Jitter tolerance
        }
    }, { passive: false });

    window.addEventListener('pointerup', (e) => {
        if (isRadialActive) {
            executeRadialSelection();
            closeRadialMenu();
        }
    });

    // --- Chess Timer Engine ---
    let timeWhite = 0;
    let timeBlack = 0;
    let activeTimer = null; // 'white' or 'black'
    let timerInterval = null;
    let isGameActive = false;

    const timerOverlay = document.getElementById('timer-overlay');
    const whiteClockEl = document.getElementById('white-clock');
    const blackClockEl = document.getElementById('black-clock');
    
    function formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    function updateClockDOM() {
        whiteClockEl.textContent = formatTime(timeWhite);
        blackClockEl.textContent = formatTime(timeBlack);
        
        // Handle low time warnings
        whiteClockEl.classList.toggle('low-time', timeWhite <= 60 && timeWhite > 0);
        blackClockEl.classList.toggle('low-time', timeBlack <= 60 && timeBlack > 0);
    }

    function switchTurn(playerStr) {
        if (!isGameActive) return;
        
        // If a player taps their clock, switch to the other player
        activeTimer = playerStr === 'white' ? 'black' : 'white';
        
        // Update styling
        if (activeTimer === 'white') {
            whiteClockEl.classList.add('active');
            blackClockEl.classList.remove('active');
        } else {
            blackClockEl.classList.add('active');
            whiteClockEl.classList.remove('active');
        }
    }

    function handleTimeout(loser) {
        isGameActive = false;
        clearInterval(timerInterval);
        
        const victoryOverlay = document.getElementById('victory-overlay');
        const victoryTitle = document.getElementById('victory-title');
        const victorySubtitle = document.getElementById('victory-subtitle');
        const victoryScoreDisplay = document.getElementById('victory-score-display');
        
        let winnerName = '';
        let victoryColor = [];
        
        // Reset title just in case it was a draw last time
        victoryTitle.textContent = "CONGRATULATIONS!";
        
        if (score > 0) {
            winnerName = document.querySelector('.left-panel .player-name').textContent.trim() || 'PLAYER 1';
            victorySubtitle.textContent = `${winnerName} HAS WON THE GAME`;
            victoryScoreDisplay.textContent = `+${score} ADVANTAGE`;
            victoryColor = ['#ffffff', '#8c52ff']; // White and Lavender
        } else if (score < 0) {
            winnerName = document.querySelector('.right-panel .player-name').textContent.trim() || 'PLAYER 2';
            victorySubtitle.textContent = `${winnerName} HAS WON THE GAME`;
            victoryScoreDisplay.textContent = `+${Math.abs(score)} ADVANTAGE`;
            victoryColor = ['#000000', '#8c52ff']; // Black and Lavender
        } else {
            victoryTitle.textContent = "IT'S A DRAW!";
            victorySubtitle.textContent = "TIME EXPIRED WITH EQUAL MATERIAL";
            victoryScoreDisplay.textContent = "0 ADVANTAGE";
            victoryColor = ['#8c52ff', '#ffd700']; // Lavender and Gold
        }
        
        // Show Overlay
        victoryOverlay.classList.remove('hidden');
        
        // Remove active states
        whiteClockEl.classList.remove('active');
        blackClockEl.classList.remove('active');
        
        // Trigger Physics Confetti Blast
        if (window.confetti) {
            const duration = 3000;
            const end = Date.now() + duration;

            (function frame() {
                confetti({
                    particleCount: 5,
                    angle: 60,
                    spread: 55,
                    origin: { x: 0 },
                    colors: victoryColor
                });
                confetti({
                    particleCount: 5,
                    angle: 120,
                    spread: 55,
                    origin: { x: 1 },
                    colors: victoryColor
                });

                if (Date.now() < end) {
                    requestAnimationFrame(frame);
                }
            }());
        }
    }

    function startGame(totalSeconds) {
        timeWhite = totalSeconds;
        timeBlack = totalSeconds;
        isGameActive = true;
        
        updateClockDOM();
        
        timerOverlay.classList.add('hidden');
        setTimeout(() => timerOverlay.style.display = 'none', 500);
        
        // White traditionally moves first, so their clock starts ticking
        activeTimer = 'white';
        whiteClockEl.classList.add('active');
        
        timerInterval = setInterval(() => {
            if (!isGameActive) return;
            
            if (activeTimer === 'white') {
                timeWhite--;
                if (timeWhite <= 0) handleTimeout('white');
            } else if (activeTimer === 'black') {
                timeBlack--;
                if (timeBlack <= 0) handleTimeout('black');
            }
            
            updateClockDOM();
        }, 1000);
    }

    // Bind timer selection buttons
    document.querySelectorAll('.timer-option').forEach(btn => {
        btn.addEventListener('click', () => {
            // Apply player names from setup
            const setupWhite = document.getElementById('setup-player-white').value.trim();
            const setupBlack = document.getElementById('setup-player-black').value.trim();
            
            const whiteDisplay = document.getElementById('white-name-display');
            const blackDisplay = document.getElementById('black-name-display');
            
            if (setupWhite) whiteDisplay.textContent = setupWhite.toUpperCase();
            if (setupBlack) blackDisplay.textContent = setupBlack.toUpperCase();

            const secs = parseInt(btn.getAttribute('data-seconds'), 10);
            startGame(secs);
        });
    });

    // Bind Play Again Button from Victory Modal
    document.getElementById('play-again-btn').addEventListener('click', () => {
        document.getElementById('victory-overlay').classList.add('hidden');
        resetBtn.click(); // Trigger the exact same global reset sequence
    });

    // Bind clock tapping to switch turns
    whiteClockEl.addEventListener('click', () => {
        if (activeTimer === 'white') switchTurn('white');
    });
    
    blackClockEl.addEventListener('click', () => {
        if (activeTimer === 'black') switchTurn('black');
    });

});
