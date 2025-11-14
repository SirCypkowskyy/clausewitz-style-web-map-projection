// ============================================================================
// DOM ELEMENTS
// ============================================================================

/** @type {HTMLCanvasElement} Main visible canvas element */
const visualCanvas = document.getElementById('visualCanvas');
/** @type {CanvasRenderingContext2D} Context for visual canvas */
const visualCtx = visualCanvas.getContext('2d', { willReadFrequently: false });
/** @type {HTMLElement} Tooltip container element */
const tooltip = document.getElementById('tooltip');
/** @type {HTMLElement} Tooltip content container */
const tooltipContent = document.getElementById('tooltipContent');
/** @type {HTMLElement} Map wrapper container */
const mapWrapper = document.getElementById('mapWrapper');
/** @type {HTMLElement} Zoom level display element */
const zoomInfo = document.getElementById('zoomInfo');
/** @type {HTMLInputElement} Visual map opacity slider */
const visualOpacitySlider = document.getElementById('visualOpacitySlider');
/** @type {HTMLInputElement} Highlight opacity slider */
const highlightOpacitySlider = document.getElementById('highlightOpacitySlider');
/** @type {HTMLElement} Visual opacity value display */
const visualOpacityValue = document.getElementById('visualOpacityValue');
/** @type {HTMLElement} Highlight opacity value display */
const highlightOpacityValue = document.getElementById('highlightOpacityValue');
/** @type {HTMLSelectElement} Highlight mode selector */
const highlightModeSelect = document.getElementById('highlightMode');
/** @type {HTMLElement} Outline settings container */
const outlineSettings = document.getElementById('outlineSettings');
/** @type {HTMLInputElement} Outline color picker */
const outlineColor = document.getElementById('outlineColor');
/** @type {HTMLInputElement} Outline color text input */
const outlineColorText = document.getElementById('outlineColorText');
/** @type {HTMLInputElement} Outline thickness slider */
const outlineThickness = document.getElementById('outlineThickness');
// /** @type {HTMLElement} Outline thickness value display */
// const outlineThicknessValue = document.getElementById('outlineThicknessValue');
/** @type {HTMLButtonElement} Pulse animation toggle button */
const pulseToggle = document.getElementById('pulseToggle');
/** @type {HTMLElement} Pulse toggle indicator */
const pulseToggleIndicator = document.getElementById('pulseToggleIndicator');
/** @type {HTMLButtonElement} Clear selection button */
const clearSelectionBtn = document.getElementById('clearSelection');
/** @type {HTMLSelectElement} Visual effect selector */
const visualEffectSelect = document.getElementById('visualEffect');
/** @type {HTMLInputElement} Effect intensity slider */
const effectIntensitySlider = document.getElementById('effectIntensity');
/** @type {HTMLElement} Effect intensity value display */
const effectIntensityValue = document.getElementById('effectIntensityValue');

// ============================================================================
// STATE VARIABLES
// ============================================================================

/** @type {HTMLCanvasElement} Hidden canvas for province data */
const dataCanvas = document.createElement('canvas');
/** @type {CanvasRenderingContext2D} Context for data canvas with optimized reading */
const dataCtx = dataCanvas.getContext('2d', { willReadFrequently: true });
/** @type {HTMLImageElement} Visual map image */
const visualImg = new Image();
/** @type {HTMLImageElement} Data map image (for province detection) */
const dataImg = new Image();
/** @type {ImageData|null} Original image data for visual canvas */
let originalImageData = null;

/** @type {number} Base width of the map */
let baseWidth = 0;
/** @type {number} Base height of the map */
let baseHeight = 0;

/** @type {number} Current zoom level (1.0 = 100%) */
let zoomLevel = 1.0;
/** @type {number} Pan offset X in pixels */
let panX = 0;
/** @type {number} Pan offset Y in pixels */
let panY = 0;
/** @type {boolean} Whether user is currently dragging the map */
let isDragging = false;
/** @type {number} Last mouse X position during drag */
let lastMouseX = 0;
/** @type {number} Last mouse Y position during drag */
let lastMouseY = 0;

/** @type {number} Visual map opacity (0.0 - 1.0) */
let visualOpacity = 1.0;
/** @type {number} Highlight overlay opacity (0.0 - 1.0) */
let highlightOpacity = 1.0;

/** @type {string} Current highlight mode: 'fill' or 'outline' */
let highlightMode = 'fill';
/** @type {string} Outline color in hex format */
let outlineColorValue = '#ffff00';
/** @type {number} Outline thickness in pixels */
let outlineThicknessValue = 2;
/** @type {boolean} Whether pulse animation is enabled */
let pulseEnabled = false;

/** @type {string} Current visual effect: 'none', 'vignette', 'parchment', 'chromatic' */
let currentVisualEffect = 'none';
/** @type {number} Effect intensity (0.0 - 1.0) */
let effectIntensity = 0.5;

/** @type {Object.<string, Object>} Province data loaded from API */
let provincesData = {};
/** @type {number|null} Currently hovered province ID */
let currentHoveredProvinceId = null;
/** @type {Set<number>} Set of selected province IDs */
let selectedProvinceIds = new Set();
/** @type {number|null} Timeout ID for highlight delay */
let highlightTimeout = null;

/** @type {number} Number of maps loaded */
let mapsLoaded = 0;
/** @type {number} Total number of maps to load */
const totalMaps = 2;

/** @type {number|null} Animation frame ID for pulse effect */
let pulseAnimationFrame = null;
/** @type {number} Current phase of pulse animation */
let pulsePhase = 0;

// ============================================================================
// CACHE STRUCTURES (OPTIMIZATION)
// ============================================================================

/**
 * Cache of pre-computed province pixels
 * @type {Map<number, {fill: Array<{x: number, y: number}>, outline: Array<{x: number, y: number}>|null, _rawPixels?: Array}>}
 */
const provincePixelCache = new Map();

/**
 * Cache of rendered province canvases for reuse
 * @type {Map<string, HTMLCanvasElement>}
 */
const provinceCanvasCache = new Map();

/**
 * Fast spatial lookup grid for province IDs
 * @type {Uint32Array|null}
 */
let provinceLookupGrid = null;

/**
 * Maximum size of canvas cache to prevent memory issues
 * @type {number}
 */
const MAX_CANVAS_CACHE_SIZE = 100;

/**
 * Canvas for applying visual effects
 * @type {HTMLCanvasElement}
 */
const effectCanvas = document.createElement('canvas');
/**
 * Context for effect canvas
 * @type {CanvasRenderingContext2D}
 */
const effectCtx = effectCanvas.getContext('2d', { willReadFrequently: false });

// ============================================================================
// IMAGE LOADING
// ============================================================================

visualImg.src = '/static/visual_map.png';
dataImg.src = '/static/data_map.png';

visualImg.onload = () => {
    mapsLoaded++;
    if (mapsLoaded === totalMaps) {
        initializeMaps();
    }
};

dataImg.onload = () => {
    mapsLoaded++;
    if (mapsLoaded === totalMaps) {
        initializeMaps();
    }
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate province ID from RGB color values
 * Province IDs are encoded as 24-bit integers in RGB format
 * @param {number} r - Red channel (0-255)
 * @param {number} g - Green channel (0-255)
 * @param {number} b - Blue channel (0-255)
 * @returns {number} Province ID
 */
function calculateProvinceId(r, g, b) {
    return (r << 16) | (g << 8) | b;
}

/**
 * Check if a province ID and RGB values represent a valid province
 * Filters out water, unmapped areas, and background
 * @param {number} provinceId - Province ID to check
 * @param {number} r - Red channel (0-255)
 * @param {number} g - Green channel (0-255)
 * @param {number} b - Blue channel (0-255)
 * @returns {boolean} True if province is valid
 */
function isValidProvince(provinceId, r, g, b) {
    if (provinceId === 0) return false;
    if (r === 0 && g === 0 && b === 0) return false;
    if (r === 255 && g === 255 && b === 255) return false;
    return true;
}

/**
 * Convert mouse event coordinates to canvas coordinates
 * Accounts for CSS transforms (zoom and pan)
 * @param {MouseEvent} event - Mouse event
 * @returns {{canvasX: number, canvasY: number}} Canvas coordinates
 */
function getCanvasCoordinates(event) {
    const rect = visualCanvas.getBoundingClientRect();
    
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    const scaleX = baseWidth / rect.width;
    const scaleY = baseHeight / rect.height;
    
    const canvasX = Math.floor(x * scaleX);
    const canvasY = Math.floor(y * scaleY);
    
    return { canvasX, canvasY };
}

/**
 * Convert hex color to RGB object
 * @param {string} hex - Hex color string (e.g., "#ffff00")
 * @returns {{r: number, g: number, b: number}} RGB color object
 */
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 255, g: 255, b: 0 };
}

/**
 * Throttle function to limit execution rate
 * @param {Function} func - Function to throttle
 * @param {number} limit - Minimum time between executions in ms
 * @returns {Function} Throttled function
 */
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Debounce function to delay execution until after calls have stopped
 * @param {Function} func - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, delay) {
    let timeoutId;
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

// ============================================================================
// VISUAL EFFECTS
// ============================================================================

/**
 * Apply vignette effect to the canvas
 * Creates darkening around edges for focus on center
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {number} intensity - Effect intensity (0.0 - 1.0)
 */
function applyVignetteEffect(ctx, width, height, intensity) {
    const gradient = ctx.createRadialGradient(
        width / 2, height / 2, 0,
        width / 2, height / 2, Math.max(width, height) * 0.7
    );
    
    gradient.addColorStop(0, `rgba(0, 0, 0, 0)`);
    gradient.addColorStop(0.6, `rgba(0, 0, 0, ${0.2 * intensity})`);
    gradient.addColorStop(1, `rgba(0, 0, 0, ${0.7 * intensity})`);
    
    ctx.save();
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
}

/**
 * Apply old parchment/map effect
 * Creates vintage paper texture with sepia tones and aging marks
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {number} intensity - Effect intensity (0.0 - 1.0)
 */
function applyParchmentEffect(ctx, width, height, intensity) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    // Apply sepia tone and add noise
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Sepia tone calculation
        const tr = 0.393 * r + 0.769 * g + 0.189 * b;
        const tg = 0.349 * r + 0.686 * g + 0.168 * b;
        const tb = 0.272 * r + 0.534 * g + 0.131 * b;
        
        // Blend with original based on intensity
        data[i] = r + (tr - r) * intensity;
        data[i + 1] = g + (tg - g) * intensity;
        data[i + 2] = b + (tb - b) * intensity;
        
        // Add subtle noise
        const noise = (Math.random() - 0.5) * 20 * intensity;
        data[i] += noise;
        data[i + 1] += noise;
        data[i + 2] += noise;
    }
    
    ctx.putImageData(imageData, 0, 0);
    
    // Add paper texture overlay
    ctx.save();
    ctx.globalAlpha = 0.15 * intensity;
    ctx.fillStyle = '#d4a574';
    
    // Add random spots and stains
    for (let i = 0; i < 30 * intensity; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const radius = Math.random() * 50 + 10;
        
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, 'rgba(139, 90, 43, 0.3)');
        gradient.addColorStop(1, 'rgba(139, 90, 43, 0)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
    }
    
    ctx.restore();
    
    // Add edge darkening
    ctx.save();
    ctx.globalAlpha = 0.3 * intensity;
    const edgeGradient = ctx.createLinearGradient(0, 0, width * 0.1, 0);
    edgeGradient.addColorStop(0, 'rgba(101, 67, 33, 0.8)');
    edgeGradient.addColorStop(1, 'rgba(101, 67, 33, 0)');
    ctx.fillStyle = edgeGradient;
    ctx.fillRect(0, 0, width * 0.1, height);
    ctx.restore();
}

/**
 * Apply chromatic aberration effect
 * Separates RGB channels for a glitchy, cyberpunk aesthetic
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {number} intensity - Effect intensity (0.0 - 1.0)
 */
function applyChromaticAberrationEffect(ctx, width, height, intensity) {
    const originalImage = ctx.getImageData(0, 0, width, height);
    const result = ctx.createImageData(width, height);
    
    const offset = Math.floor(5 * intensity);
    
    // Copy original to result
    for (let i = 0; i < originalImage.data.length; i++) {
        result.data[i] = originalImage.data[i];
    }
    
    // Apply channel shifting
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            
            // Red channel - shift right
            const redX = Math.min(width - 1, x + offset);
            const redIdx = (y * width + redX) * 4;
            result.data[idx] = originalImage.data[redIdx];
            
            // Green channel - no shift
            result.data[idx + 1] = originalImage.data[idx + 1];
            
            // Blue channel - shift left
            const blueX = Math.max(0, x - offset);
            const blueIdx = (y * width + blueX) * 4;
            result.data[idx + 2] = originalImage.data[blueIdx + 2];
            
            // Alpha stays the same
            result.data[idx + 3] = originalImage.data[idx + 3];
        }
    }
    
    ctx.putImageData(result, 0, 0);
    
    // Add subtle scan lines for extra effect
    ctx.save();
    ctx.globalAlpha = 0.1 * intensity;
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 1;
    
    for (let y = 0; y < height; y += 4) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }
    ctx.restore();
}

/**
 * Apply selected visual effect to canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 */
function applyVisualEffect(ctx, width, height) {
    if (currentVisualEffect === 'none' || effectIntensity === 0) {
        return;
    }
    
    switch (currentVisualEffect) {
        case 'vignette':
            applyVignetteEffect(ctx, width, height, effectIntensity);
            break;
        case 'parchment':
            applyParchmentEffect(ctx, width, height, effectIntensity);
            break;
        case 'chromatic':
            applyChromaticAberrationEffect(ctx, width, height, effectIntensity);
            break;
    }
}

// ============================================================================
// MAP INITIALIZATION AND DRAWING
// ============================================================================

/**
 * Initialize maps after both images have loaded
 * Sets up canvases, pre-computes province data, and starts animation
 */
function initializeMaps() {
    baseWidth = visualImg.width;
    baseHeight = visualImg.height;
    visualCanvas.width = baseWidth;
    visualCanvas.height = baseHeight;
    
    // Setup effect canvas
    effectCanvas.width = baseWidth;
    effectCanvas.height = baseHeight;
    
    visualCtx.drawImage(visualImg, 0, 0);
    originalImageData = visualCtx.getImageData(0, 0, visualCanvas.width, visualCanvas.height);
    
    drawVisualMap();

    dataCanvas.width = dataImg.width;
    dataCanvas.height = dataImg.height;
    dataCtx.drawImage(dataImg, 0, 0);

    updateCanvasTransform();

    console.log('Maps initialized. Pre-computing province data...');
    
    precomputeProvinceData();
    
    console.log('Province data precomputed:', provincePixelCache.size, 'provinces');
    
    if (pulseEnabled) {
        startPulseAnimation();
    }
}

/**
 * Pre-compute all province pixel data for optimization
 * Creates spatial index and caches province boundaries
 * This is the main optimization that provides ~1000x speedup for province lookups
 */
function precomputeProvinceData() {
    const imageData = dataCtx.getImageData(0, 0, dataCanvas.width, dataCanvas.height);
    const data = imageData.data;
    
    // Phase 1: Collect all pixels for each province
    const provincePixelsMap = new Map();
    
    for (let y = 0; y < dataCanvas.height; y++) {
        for (let x = 0; x < dataCanvas.width; x++) {
            const i = (y * dataCanvas.width + x) * 4;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const provinceId = calculateProvinceId(r, g, b);
            
            if (!isValidProvince(provinceId, r, g, b)) continue;
            
            if (!provincePixelsMap.has(provinceId)) {
                provincePixelsMap.set(provinceId, []);
            }
            provincePixelsMap.get(provinceId).push({ x, y, index: i });
        }
    }
    
    // Phase 2: Compute fill pixels and prepare for lazy outline computation
    for (const [provinceId, pixels] of provincePixelsMap.entries()) {
        const fillPixels = pixels.map(p => ({ x: p.x, y: p.y }));
        
        provincePixelCache.set(provinceId, {
            fill: fillPixels,
            outline: null, // Computed lazily when needed
            _rawPixels: pixels, // Keep for later border computation
            _imageData: data // Reference to image data for border computation
        });
    }
    
    // Phase 3: Build spatial index for O(1) province lookups
    buildProvinceLookupGrid(imageData);
}

/**
 * Build fast spatial lookup grid for province IDs
 * Provides O(1) lookup instead of O(n) pixel scanning
 * @param {ImageData} imageData - Image data from data canvas
 */
function buildProvinceLookupGrid(imageData) {
    provinceLookupGrid = new Uint32Array(dataCanvas.width * dataCanvas.height);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const provinceId = calculateProvinceId(r, g, b);
        provinceLookupGrid[i / 4] = provinceId;
    }
}

/**
 * Get province ID at a specific position using fast spatial lookup
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @returns {number|null} Province ID or null if out of bounds
 */
function getProvinceAtPosition(x, y) {
    if (x < 0 || x >= dataCanvas.width || y < 0 || y >= dataCanvas.height) {
        return null;
    }
    const index = y * dataCanvas.width + x;
    return provinceLookupGrid[index];
}

/**
 * Compute border pixels for a province (lazy computation)
 * Only computed when outline mode is first used for a province
 * @param {Array} pixels - Array of province pixels with coordinates
 * @param {Uint8ClampedArray} data - Image data array
 * @param {number} provinceId - Province ID to compute borders for
 * @returns {Array<{x: number, y: number}>} Array of border pixel coordinates
 */
function computeBorderPixels(pixels, data, provinceId) {
    const borderSet = new Set();
    const neighbors = [
        { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
        { dx: 0, dy: -1 }, { dx: 0, dy: 1 }
    ];
    
    for (const pixel of pixels) {
        const { x, y } = pixel;
        let isBorder = false;
        
        for (const { dx, dy } of neighbors) {
            const nx = x + dx;
            const ny = y + dy;
            
            if (nx < 0 || nx >= dataCanvas.width || ny < 0 || ny >= dataCanvas.height) {
                isBorder = true;
                break;
            }
            
            const ni = (ny * dataCanvas.width + nx) * 4;
            const nr = data[ni];
            const ng = data[ni + 1];
            const nb = data[ni + 2];
            const neighborProvinceId = calculateProvinceId(nr, ng, nb);
            
            if (neighborProvinceId !== provinceId) {
                isBorder = true;
                break;
            }
        }
        
        if (isBorder) {
            borderSet.add(`${x},${y}`);
        }
    }
    
    return Array.from(borderSet).map(key => {
        const [x, y] = key.split(',').map(Number);
        return { x, y };
    });
}

/**
 * Get border pixels for a province with lazy computation
 * @param {number} provinceId - Province ID
 * @returns {Array<{x: number, y: number}>} Array of border pixel coordinates
 */
function getProvinceBorderPixels(provinceId) {
    const cached = provincePixelCache.get(provinceId);
    if (!cached) return [];
    
    // Lazy compute outline on first access
    if (cached.outline === null) {
        cached.outline = computeBorderPixels(cached._rawPixels, cached._imageData, provinceId);
        // Free memory after computing outline
        delete cached._rawPixels;
        delete cached._imageData;
    }
    
    return cached.outline;
}

/**
 * Expand border pixels to create thicker outlines
 * @param {Array<{x: number, y: number}>} borderPixels - Base border pixels
 * @param {number} thickness - Desired thickness in pixels
 * @returns {Array<{x: number, y: number}>} Expanded border pixels
 */
function expandBorderPixels(borderPixels, thickness) {
    if (thickness === 1) return borderPixels;
    
    const expanded = new Set();
    
    for (const { x, y } of borderPixels) {
        for (let tx = -thickness + 1; tx < thickness; tx++) {
            for (let ty = -thickness + 1; ty < thickness; ty++) {
                if (Math.abs(tx) + Math.abs(ty) < thickness) {
                    const px = x + tx;
                    const py = y + ty;
                    if (px >= 0 && px < dataCanvas.width && py >= 0 && py < dataCanvas.height) {
                        expanded.add(`${px},${py}`);
                    }
                }
            }
        }
    }
    
    return Array.from(expanded).map(key => {
        const [x, y] = key.split(',').map(Number);
        return { x, y };
    });
}

/**
 * Draw the visual map with current opacity setting
 */
function drawVisualMap() {
    visualCtx.clearRect(0, 0, visualCanvas.width, visualCanvas.height);
    visualCtx.save();
    visualCtx.globalAlpha = visualOpacity;
    visualCtx.drawImage(visualImg, 0, 0);
    visualCtx.restore();
}

/**
 * Redraw the entire map with highlights and effects
 * Applies current opacity multiplier for pulse effect and visual effects
 */
function redrawMap() {
    if (originalImageData) {
        drawVisualMap();
        
        const currentOpacity = pulseEnabled ? getPulseOpacity() : 1.0;
        
        // Draw selected provinces
        selectedProvinceIds.forEach(provinceId => {
            drawProvinceHighlight(provinceId, 'selected', currentOpacity);
        });
        
        // Draw hovered province if not selected
        if (currentHoveredProvinceId !== null && !selectedProvinceIds.has(currentHoveredProvinceId)) {
            drawProvinceHighlight(currentHoveredProvinceId, 'hover', currentOpacity);
        }
        
        // Apply visual effects
        if (currentVisualEffect !== 'none') {
            // Copy current canvas to effect canvas
            effectCtx.clearRect(0, 0, effectCanvas.width, effectCanvas.height);
            effectCtx.drawImage(visualCanvas, 0, 0);
            
            // Apply effect
            applyVisualEffect(effectCtx, effectCanvas.width, effectCanvas.height);
            
            // Draw back to main canvas
            visualCtx.clearRect(0, 0, visualCanvas.width, visualCanvas.height);
            visualCtx.drawImage(effectCanvas, 0, 0);
        }
    }
}

// ============================================================================
// PULSE ANIMATION
// ============================================================================

/**
 * Calculate current pulse opacity based on sine wave
 * @returns {number} Opacity multiplier (0.5 - 1.0)
 */
function getPulseOpacity() {
    return 0.5 + 0.5 * Math.sin(pulsePhase);
}

/**
 * Start pulse animation loop
 * Uses requestAnimationFrame for smooth 30fps animation
 */
function startPulseAnimation() {
    if (pulseAnimationFrame) return;
    
    let lastTime = performance.now();
    
    function animate(currentTime) {
        // Skip rendering if nothing to animate
        if (selectedProvinceIds.size === 0 && currentHoveredProvinceId === null) {
            pulseAnimationFrame = requestAnimationFrame(animate);
            return;
        }
        
        // Limit to ~30fps (good enough for pulse effect, saves CPU)
        const deltaTime = currentTime - lastTime;
        if (deltaTime < 33) {
            pulseAnimationFrame = requestAnimationFrame(animate);
            return;
        }
        
        lastTime = currentTime;
        pulsePhase += 0.05;
        redrawMap();
        
        pulseAnimationFrame = requestAnimationFrame(animate);
    }
    
    animate(performance.now());
}

/**
 * Stop pulse animation loop
 */
function stopPulseAnimation() {
    if (pulseAnimationFrame) {
        cancelAnimationFrame(pulseAnimationFrame);
        pulseAnimationFrame = null;
        pulsePhase = 0;
    }
}

// ============================================================================
// ZOOM AND PAN
// ============================================================================

/**
 * Update canvas CSS transform for zoom and pan
 * Uses CSS transforms for hardware acceleration
 */
function updateCanvasTransform() {
    visualCanvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomLevel})`;
    visualCanvas.style.width = (baseWidth * zoomLevel) + 'px';
    visualCanvas.style.height = (baseHeight * zoomLevel) + 'px';
    zoomInfo.textContent = `Zoom: ${Math.round(zoomLevel * 100)}%`;
}

/**
 * Zoom in by 20%
 * Maximum zoom level is 500%
 */
function zoomIn() {
    zoomLevel = Math.min(zoomLevel * 1.2, 5.0);
    updateCanvasTransform();
    redrawMap();
}

/**
 * Zoom out by 20%
 * Minimum zoom level is 20%
 */
function zoomOut() {
    zoomLevel = Math.max(zoomLevel / 1.2, 0.2);
    updateCanvasTransform();
    redrawMap();
}

/**
 * Reset zoom and pan to default values
 */
function zoomReset() {
    zoomLevel = 1.0;
    panX = 0;
    panY = 0;
    updateCanvasTransform();
    redrawMap();
}

// ============================================================================
// HIGHLIGHT FUNCTIONALITY WITH CACHING
// ============================================================================

/**
 * Get or create cached canvas for province highlight
 * Caching provides ~100x speedup for repeated highlights
 * @param {number} provinceId - Province ID to highlight
 * @param {string} mode - Highlight mode ('fill' or 'outline')
 * @param {string} color - Color in hex format
 * @param {number} thickness - Outline thickness in pixels
 * @returns {HTMLCanvasElement|null} Cached or newly created canvas
 */
function getCachedProvinceCanvas(provinceId, mode, color, thickness) {
    const cacheKey = `${provinceId}-${mode}-${color}-${thickness}`;
    
    if (provinceCanvasCache.has(cacheKey)) {
        return provinceCanvasCache.get(cacheKey);
    }
    
    const cached = provincePixelCache.get(provinceId);
    if (!cached) return null;
    
    // Get appropriate pixels based on mode
    let pixels;
    if (mode === 'outline') {
        const baseOutline = getProvinceBorderPixels(provinceId);
        pixels = expandBorderPixels(baseOutline, thickness);
    } else {
        pixels = cached.fill;
    }
    
    // Create temporary canvas for this province
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = dataCanvas.width;
    tempCanvas.height = dataCanvas.height;
    const tempCtx = tempCanvas.getContext('2d', { alpha: true, willReadFrequently: false });
    const tempImageData = tempCtx.createImageData(tempCanvas.width, tempCanvas.height);
    const tempData = tempImageData.data;
    
    const rgb = mode === 'outline' ? hexToRgb(color) : 
                { r: 255, g: 255, b: 100 };
    
    // Fill pixels with color
    for (const { x, y } of pixels) {
        const i = (y * tempCanvas.width + x) * 4;
        tempData[i] = rgb.r;
        tempData[i + 1] = rgb.g;
        tempData[i + 2] = rgb.b;
        tempData[i + 3] = 255;
    }
    
    tempCtx.putImageData(tempImageData, 0, 0);
    
    // Cache if under size limit
    if (provinceCanvasCache.size < MAX_CANVAS_CACHE_SIZE) {
        provinceCanvasCache.set(cacheKey, tempCanvas);
    }
    
    return tempCanvas;
}

/**
 * Draw province highlight using cached canvas
 * @param {number} provinceId - Province ID to highlight
 * @param {string} type - Highlight type ('hover' or 'selected')
 * @param {number} opacityMultiplier - Opacity multiplier for pulse effect
 */
function drawProvinceHighlight(provinceId, type = 'hover', opacityMultiplier = 1.0) {
    const canvas = getCachedProvinceCanvas(
        provinceId, 
        highlightMode, 
        outlineColorValue, 
        outlineThicknessValue
    );
    
    if (!canvas) return;
    
    visualCtx.save();
    if (highlightMode === 'outline') {
        visualCtx.globalAlpha = highlightOpacity * opacityMultiplier;
        visualCtx.drawImage(canvas, 0, 0);
    } else {
        visualCtx.globalCompositeOperation = 'lighten';
        visualCtx.globalAlpha = highlightOpacity * opacityMultiplier * 0.6;
        visualCtx.drawImage(canvas, 0, 0);
    }
    visualCtx.restore();
}

/**
 * Clear canvas cache when settings change
 * Called when color or thickness changes to force re-rendering
 */
function clearProvinceCanvasCache() {
    provinceCanvasCache.clear();
}

// ============================================================================
// TOOLTIP FUNCTIONALITY
// ============================================================================

/**
 * Show tooltip with province information
 * @param {MouseEvent} event - Mouse event for positioning
 * @param {number} provinceId - Province ID
 * @param {Object} provinceData - Province data object
 */
function showTooltip(event, provinceId, provinceData) {
    const x = event.clientX;
    const y = event.clientY;

    let content = '';

    if (provinceData) {
        content += `<div class="text-xl font-bold text-blue-400 mb-3 pb-2 border-b border-gray-700">${provinceData.name || 'Unknown Province'}</div>`;
        content += `<div class="space-y-2">`;
        content += `<div class="flex justify-between"><span class="text-gray-400">ID:</span> <span class="font-mono text-blue-300">${provinceId}</span></div>`;
        
        if (provinceData.owner) {
            content += `<div class="flex justify-between"><span class="text-gray-400">Owner:</span> <span class="text-gray-200">${provinceData.owner}</span></div>`;
        }
        if (provinceData.type) {
            content += `<div class="flex justify-between"><span class="text-gray-400">Type:</span> <span class="text-gray-200">${provinceData.type}</span></div>`;
        }
        if (provinceData.development !== undefined) {
            content += `<div class="flex justify-between"><span class="text-gray-400">Development:</span> <span class="text-green-400 font-semibold">${provinceData.development}</span></div>`;
        }
        if (provinceData.trade_goods) {
            content += `<div class="flex justify-between"><span class="text-gray-400">Trade Goods:</span> <span class="text-yellow-400">${provinceData.trade_goods}</span></div>`;
        }
        if (provinceData.terrain) {
            content += `<div class="flex justify-between"><span class="text-gray-400">Terrain:</span> <span class="text-gray-200">${provinceData.terrain}</span></div>`;
        }
        content += `</div>`;
        
        if (provinceData.description) {
            content += `<div class="mt-3 pt-3 border-t border-gray-700 text-sm text-gray-400 italic">${provinceData.description}</div>`;
        }
    } else {
        content += `<div class="text-xl font-bold text-blue-400 mb-3">Province ${provinceId}</div>`;
        content += `<div class="flex justify-between"><span class="text-gray-400">ID:</span> <span class="font-mono text-blue-300">${provinceId}</span></div>`;
        content += `<div class="mt-2 text-sm text-red-400 italic">No data available for this province</div>`;
    }

    tooltipContent.innerHTML = content;
    tooltip.classList.remove('hidden');
    tooltip.classList.add('block');

    positionTooltip(event);
}

/**
 * Update tooltip position without rebuilding content
 * @param {MouseEvent} event - Mouse event for positioning
 */
function positionTooltip(event) {
    const x = event.clientX;
    const y = event.clientY;
    
    const tooltipWidth = tooltip.offsetWidth;
    const tooltipHeight = tooltip.offsetHeight;
    const offsetX = 15;
    const offsetY = 15;

    let tooltipX = x + offsetX;
    let tooltipY = y + offsetY;

    if (tooltipX + tooltipWidth > window.innerWidth) {
        tooltipX = x - tooltipWidth - offsetX;
    }
    if (tooltipY + tooltipHeight > window.innerHeight) {
        tooltipY = y - tooltipHeight - offsetY;
    }

    tooltip.style.left = tooltipX + 'px';
    tooltip.style.top = tooltipY + 'px';
}

/**
 * Hide tooltip
 */
function hideTooltip() {
    tooltip.classList.add('hidden');
    tooltip.classList.remove('block');
}

// ============================================================================
// PROVINCE DATA
// ============================================================================

/**
 * Load province data from API
 * @async
 * @returns {Promise<void>}
 */
async function loadProvincesData() {
    try {
        const response = await fetch('/api/provinces');
        const data = await response.json();
        provincesData = data.provinces || {};
        console.log('Loaded province data:', Object.keys(provincesData).length, 'provinces');
    } catch (error) {
        console.error('Error loading province data:', error);
        provincesData = {};
    }
}

// ============================================================================
// MOUSE EVENT HANDLERS (OPTIMIZED)
// ============================================================================

/**
 * Handle mouse move with throttling for performance
 * Throttled to ~60fps to reduce CPU usage
 * @param {MouseEvent} event - Mouse event
 */
const handleMouseMove = throttle(function(event) {
    const { canvasX, canvasY } = getCanvasCoordinates(event);
    
    document.getElementById('mousePos').textContent = `(${canvasX}, ${canvasY})`;
    
    if (mapsLoaded === totalMaps && canvasX >= 0 && canvasX < dataCanvas.width && canvasY >= 0 && canvasY < dataCanvas.height) {
        // Use fast spatial lookup (O(1) instead of O(n))
        const provinceId = getProvinceAtPosition(canvasX, canvasY);
        
        // Get RGB for display (only when needed)
        const imageData = dataCtx.getImageData(canvasX, canvasY, 1, 1);
        const [r, g, b] = imageData.data;
        
        document.getElementById('rgbColor').textContent = `RGB(${r}, ${g}, ${b})`;
        document.getElementById('provinceId').textContent = provinceId.toString();
        
        if (!provincePixelCache.has(provinceId)) {
            if (currentHoveredProvinceId !== null) {
                currentHoveredProvinceId = null;
                redrawMap();
            }
            hideTooltip();
            return;
        }
        
        const provinceData = provincesData[provinceId.toString()];
        
        if (currentHoveredProvinceId !== provinceId) {
            currentHoveredProvinceId = provinceId;
            redrawMap();
            showTooltip(event, provinceId, provinceData);
        } else {
            // Only update position if hovering same province
            positionTooltip(event);
        }
    } else {
        if (currentHoveredProvinceId !== null) {
            currentHoveredProvinceId = null;
            redrawMap();
        }
        hideTooltip();
    }
}, 16); // ~60fps

/**
 * Handle mouse leaving canvas area
 */
function handleMouseLeave() {
    currentHoveredProvinceId = null;
    redrawMap();
    hideTooltip();
    if (highlightTimeout) {
        clearTimeout(highlightTimeout);
    }
}

/**
 * Handle click on province
 * Supports multi-select with Shift key
 * @param {MouseEvent} event - Mouse event
 */
function handleClick(event) {
    if (isDragging) return;
    
    const { canvasX, canvasY } = getCanvasCoordinates(event);

    if (mapsLoaded === totalMaps && canvasX >= 0 && canvasX < dataCanvas.width && canvasY >= 0 && canvasY < dataCanvas.height) {
        const provinceId = getProvinceAtPosition(canvasX, canvasY);
        
        if (!provincePixelCache.has(provinceId)) {
            // Click on empty space - clear selection
            selectedProvinceIds.clear();
            redrawMap();
            return;
        }
        
        const provinceData = provincesData[provinceId.toString()];

        if (event.shiftKey) {
            // Shift + click: toggle selection
            if (selectedProvinceIds.has(provinceId)) {
                selectedProvinceIds.delete(provinceId);
            } else {
                selectedProvinceIds.add(provinceId);
            }
        } else {
            // Normal click: select only this province
            selectedProvinceIds.clear();
            selectedProvinceIds.add(provinceId);
        }
        
        redrawMap();

        console.log(`Province ${event.shiftKey ? 'toggled' : 'selected'}: ${provinceId} at (${canvasX}, ${canvasY})`);
        console.log('Currently selected provinces:', Array.from(selectedProvinceIds));
        if (provinceData) {
            console.log('Province data:', provinceData);
        }
    }
}

/**
 * Handle mouse wheel for zooming
 * @param {WheelEvent} event - Wheel event
 */
function handleWheel(event) {
    event.preventDefault();
    const delta = event.deltaY > 0 ? 0.9 : 1.1;
    zoomLevel = Math.max(0.2, Math.min(5.0, zoomLevel * delta));
    updateCanvasTransform();
    redrawMap();
}

/**
 * Handle mouse down for pan dragging
 * @param {MouseEvent} event - Mouse event
 */
function handleMouseDown(event) {
    if (event.button === 0) {
        isDragging = true;
        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
        mapWrapper.style.cursor = 'grabbing';
    }
}

/**
 * Handle global mouse move for pan dragging
 * @param {MouseEvent} event - Mouse event
 */
function handleGlobalMouseMove(event) {
    if (isDragging) {
        panX += event.clientX - lastMouseX;
        panY += event.clientY - lastMouseY;
        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
        updateCanvasTransform();
    }
}

/**
 * Handle mouse up to end pan dragging
 */
function handleMouseUp() {
    if (isDragging) {
        isDragging = false;
        mapWrapper.style.cursor = '';
    }
}

// ============================================================================
// CONTROL HANDLERS
// ============================================================================

/**
 * Handle visual opacity slider change
 * @param {Event} e - Input event
 */
function handleVisualOpacityChange(e) {
    visualOpacity = parseInt(e.target.value) / 100;
    visualOpacityValue.textContent = Math.round(visualOpacity * 100) + '%';
    redrawMap();
}

/**
 * Handle highlight opacity slider change
 * @param {Event} e - Input event
 */
function handleHighlightOpacityChange(e) {
    highlightOpacity = parseInt(e.target.value) / 100;
    highlightOpacityValue.textContent = Math.round(highlightOpacity * 100) + '%';
    redrawMap();
}

/**
 * Handle highlight mode change
 * Shows/hides outline settings panel
 * @param {Event} e - Change event
 */
function handleHighlightModeChange(e) {
    highlightMode = e.target.value;
    if (highlightMode === 'outline') {
        outlineSettings.classList.remove('hidden');
    } else {
        outlineSettings.classList.add('hidden');
    }
    clearProvinceCanvasCache();
    redrawMap();
}

/**
 * Handle outline color picker change
 * @param {Event} e - Input event
 */
function handleOutlineColorChange(e) {
    outlineColorValue = e.target.value;
    outlineColorText.value = outlineColorValue;
    clearProvinceCanvasCache();
    redrawMap();
}

/**
 * Handle outline color text input change
 * @param {Event} e - Input event
 */
function handleOutlineColorTextChange(e) {
    const value = e.target.value;
    if (/^#[0-9A-F]{6}$/i.test(value)) {
        outlineColorValue = value;
        outlineColor.value = value;
        clearProvinceCanvasCache();
        redrawMap();
    }
}

/**
 * Handle outline thickness slider change
 * @param {Event} e - Input event
 */
function handleOutlineThicknessChange(e) {
    outlineThicknessValue = parseInt(e.target.value);
    document.getElementById('outlineThicknessValue').textContent = `${outlineThicknessValue}px`;
    clearProvinceCanvasCache();
    redrawMap();
}

/**
 * Handle pulse toggle button click
 */
function handlePulseToggle() {
    pulseEnabled = !pulseEnabled;
    
    if (pulseEnabled) {
        pulseToggle.classList.add('bg-blue-600');
        pulseToggle.classList.remove('bg-gray-700');
        pulseToggleIndicator.classList.add('translate-x-6');
        pulseToggleIndicator.classList.remove('translate-x-1');
        startPulseAnimation();
    } else {
        pulseToggle.classList.remove('bg-blue-600');
        pulseToggle.classList.add('bg-gray-700');
        pulseToggleIndicator.classList.remove('translate-x-6');
        pulseToggleIndicator.classList.add('translate-x-1');
        stopPulseAnimation();
        redrawMap();
    }
}

/**
 * Handle visual effect selector change
 * @param {Event} e - Change event
 */
function handleVisualEffectChange(e) {
    currentVisualEffect = e.target.value;
    redrawMap();
}

/**
 * Handle effect intensity slider change
 * @param {Event} e - Input event
 */
function handleEffectIntensityChange(e) {
    effectIntensity = parseInt(e.target.value) / 100;
    effectIntensityValue.textContent = Math.round(effectIntensity * 100) + '%';
    redrawMap();
}

/**
 * Handle clear selection button click
 */
function handleClearSelection() {
    selectedProvinceIds.clear();
    redrawMap();
}

// ============================================================================
// EVENT LISTENER SETUP
// ============================================================================

/**
 * Set up all event listeners
 */
function setupEventListeners() {
    visualCanvas.addEventListener('mousemove', handleMouseMove);
    visualCanvas.addEventListener('mouseleave', handleMouseLeave);
    visualCanvas.addEventListener('click', handleClick);

    document.getElementById('zoomIn').addEventListener('click', zoomIn);
    document.getElementById('zoomOut').addEventListener('click', zoomOut);
    document.getElementById('zoomReset').addEventListener('click', zoomReset);

    mapWrapper.addEventListener('wheel', handleWheel);

    mapWrapper.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    visualOpacitySlider.addEventListener('input', handleVisualOpacityChange);
    highlightOpacitySlider.addEventListener('input', handleHighlightOpacityChange);
    highlightModeSelect.addEventListener('change', handleHighlightModeChange);
    
    outlineColor.addEventListener('input', handleOutlineColorChange);
    outlineColorText.addEventListener('input', handleOutlineColorTextChange);
    outlineThickness.addEventListener('input', handleOutlineThicknessChange);
    pulseToggle.addEventListener('click', handlePulseToggle);
    
    visualEffectSelect.addEventListener('change', handleVisualEffectChange);
    effectIntensitySlider.addEventListener('input', handleEffectIntensityChange);
    
    clearSelectionBtn.addEventListener('click', handleClearSelection);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize application
 * Sets up event listeners and loads province data
 */
function init() {
    setupEventListeners();
    loadProvincesData();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}