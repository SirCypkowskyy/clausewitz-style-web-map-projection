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
/** @type {HTMLElement} Outline thickness value display */
const outlineThicknessValueObj = document.getElementById('outlineThicknessValue');
/** @type {HTMLButtonElement} Pulse animation toggle button */
const pulseToggle = document.getElementById('pulseToggle');
/** @type {HTMLElement} Pulse toggle indicator */
const pulseToggleIndicator = document.getElementById('pulseToggleIndicator');
/** @type {HTMLButtonElement} Clear selection button */
const clearSelectionBtn = document.getElementById('clearSelection');
/** @type {HTMLElement} Layers list container */
const layersList = document.getElementById('layersList');
/** @type {HTMLElement} Effects list container */
const effectsList = document.getElementById('effectsList');
/** @type {HTMLElement} Selected provinces panel */
const selectedProvincesPanel = document.getElementById('selectedProvincesPanel');
/** @type {HTMLElement} Selected provinces list */
const selectedProvincesList = document.getElementById('selectedProvincesList');
/** @type {HTMLButtonElement} Refresh layers button */
const refreshLayersBtn = document.getElementById('refreshLayers');

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
/** @type {number} Current mouse X on canvas */
let currentMouseX = 0;
/** @type {number} Current mouse Y on canvas */
let currentMouseY = 0;

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

/** @type {Array<{name: string, enabled: boolean, intensity: number}>} Active visual effects */
let activeEffects = [];

/** @type {Array<{name: string, image: HTMLImageElement, enabled: boolean, opacity: number}>} Map layers */
let mapLayers = [];

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

/** @type {number|null} Animation frame ID for effects */
let effectsAnimationFrame = null;
/** @type {number} Current phase of pulse animation */
let pulsePhase = 0;
/** @type {number} Animation time for effects */
let animationTime = 0;

// FPS Counter
let frameCount = 0;
let lastFpsUpdate = performance.now();
let currentFps = 0;

/** @type {HTMLElement} FPS counter display */
const fpsCounter = document.getElementById('fpsCounter');

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
// AVAILABLE EFFECTS CONFIGURATION
// ============================================================================

/**
 * Configuration for all available visual effects
 * @type {Array<{id: string, name: string, description: string, apply: Function}>}
 */
/**
 * Configuration for all available visual effects
 * @type {Array<{id: string, name: string, description: string, apply: Function}>}
 */
const AVAILABLE_EFFECTS = [
    {
        id: 'vignette',
        name: 'Vignette',
        description: 'Darkens edges for focus',
        apply: (ctx, width, height, intensity) => {
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
    },
    {
        id: 'parchment',
        name: 'Old Parchment',
        description: 'Vintage paper texture',
        apply: (ctx, width, height, intensity) => {
            // Optimized: Process every 2nd pixel for sepia
            const imageData = ctx.getImageData(0, 0, width, height);
            const data = imageData.data;
            
            for (let i = 0; i < data.length; i += 8) { // Skip every other pixel
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                
                const tr = 0.393 * r + 0.769 * g + 0.189 * b;
                const tg = 0.349 * r + 0.686 * g + 0.168 * b;
                const tb = 0.272 * r + 0.534 * g + 0.131 * b;
                
                data[i] = r + (tr - r) * intensity;
                data[i + 1] = g + (tg - g) * intensity;
                data[i + 2] = b + (tb - b) * intensity;
                
                // Copy to next pixel for smoother look
                data[i + 4] = data[i];
                data[i + 5] = data[i + 1];
                data[i + 6] = data[i + 2];
            }
            
            ctx.putImageData(imageData, 0, 0);
            
            // Reduced number of stains
            ctx.save();
            ctx.globalAlpha = 0.08 * intensity;
            const stainCount = Math.floor(10 * intensity);
            for (let i = 0; i < stainCount; i++) {
                const x = Math.random() * width;
                const y = Math.random() * height;
                const radius = Math.random() * 30 + 10;
                
                const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
                gradient.addColorStop(0, 'rgba(139, 90, 43, 0.3)');
                gradient.addColorStop(1, 'rgba(139, 90, 43, 0)');
                
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
    },
    {
        id: 'chromatic',
        name: 'Chromatic Aberration',
        description: 'RGB channel separation',
        apply: (ctx, width, height, intensity) => {
            // Optimized: Smaller offset and direct manipulation
            const imageData = ctx.getImageData(0, 0, width, height);
            const data = imageData.data;
            const offset = Math.floor(3 * intensity);
            
            // Only process if offset is significant
            if (offset < 1) return;
            
            // Create temp array for red channel
            const tempRed = new Uint8ClampedArray(data.length / 4);
            for (let i = 0; i < data.length; i += 4) {
                tempRed[i / 4] = data[i];
            }
            
            // Shift red channel
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const sourceX = Math.min(width - 1, x + offset);
                    const sourceIdx = y * width + sourceX;
                    const destIdx = (y * width + x) * 4;
                    data[destIdx] = tempRed[sourceIdx];
                }
            }
            
            ctx.putImageData(imageData, 0, 0);
        }
    },
    {
        id: 'scanlines',
        name: 'Scan Lines',
        description: 'CRT monitor effect',
        apply: (ctx, width, height, intensity) => {
            ctx.save();
            ctx.globalAlpha = 0.15 * intensity;
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1;
            
            for (let y = 0; y < height; y += 3) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
                ctx.stroke();
            }
            ctx.restore();
        }
    },
    {
        id: 'filmgrain',
        name: 'Film Grain',
        description: 'Analog film texture',
        apply: (ctx, width, height, intensity) => {
            // Optimized: Process every 4th pixel
            const imageData = ctx.getImageData(0, 0, width, height);
            const data = imageData.data;
            
            for (let i = 0; i < data.length; i += 16) {
                const noise = (Math.random() - 0.5) * 40 * intensity;
                data[i] = Math.max(0, Math.min(255, data[i] + noise));
                data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
                data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
            }
            
            ctx.putImageData(imageData, 0, 0);
        }
    },
    {
        id: 'oldmap',
        name: 'Old Map Style',
        description: 'Antique cartography look',
        apply: (ctx, width, height, intensity) => {
            // Optimized: Lighter sepia processing
            const imageData = ctx.getImageData(0, 0, width, height);
            const data = imageData.data;
            
            const sepiaStrength = intensity * 0.5;
            
            for (let i = 0; i < data.length; i += 8) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                
                const gray = 0.299 * r + 0.587 * g + 0.114 * b;
                data[i] = gray + (r - gray) * (1 - sepiaStrength) + 40 * sepiaStrength;
                data[i + 1] = gray + (g - gray) * (1 - sepiaStrength) + 20 * sepiaStrength;
                data[i + 2] = gray + (b - gray) * (1 - sepiaStrength);
                
                // Copy to next pixel
                data[i + 4] = data[i];
                data[i + 5] = data[i + 1];
                data[i + 6] = data[i + 2];
            }
            
            ctx.putImageData(imageData, 0, 0);
            
            // Simple edge darkening
            ctx.save();
            ctx.globalAlpha = 0.3 * intensity;
            const gradient = ctx.createLinearGradient(0, 0, width, 0);
            gradient.addColorStop(0, 'rgba(60, 40, 20, 0.6)');
            gradient.addColorStop(0.1, 'rgba(60, 40, 20, 0)');
            gradient.addColorStop(0.9, 'rgba(60, 40, 20, 0)');
            gradient.addColorStop(1, 'rgba(60, 40, 20, 0.6)');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, width, height);
            ctx.restore();
        }
    },
    {
        id: 'holographic',
        name: 'Holographic',
        description: 'Futuristic hologram effect',
        apply: (ctx, width, height, intensity, time) => {
            // Optimized: Simplified wave calculation
            ctx.save();
            ctx.globalAlpha = 0.15 * intensity;
            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = 1;
            
            const waveSpeed = time * 2;
            for (let y = 0; y < height; y += 4) {
                const wave = Math.sin(y * 0.02 + waveSpeed) * 5;
                ctx.beginPath();
                ctx.moveTo(wave, y);
                ctx.lineTo(width + wave, y);
                ctx.stroke();
            }
            ctx.restore();
            
            // Add scan line
            const scanY = (time * 100) % height;
            ctx.save();
            ctx.globalAlpha = 0.3 * intensity;
            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, scanY);
            ctx.lineTo(width, scanY);
            ctx.stroke();
            ctx.restore();
        }
    },
    {
        id: 'glitch',
        name: 'Glitch',
        description: 'Digital corruption effect',
        apply: (ctx, width, height, intensity, time) => {
            // More aggressive glitch at high intensity
            const glitchChance = 0.15 * intensity;
            const maxShift = Math.floor(30 * intensity);
            
            // Horizontal shifts - more frequent
            if (Math.random() < glitchChance) {
                const imageData = ctx.getImageData(0, 0, width, height);
                const shiftAmount = Math.floor((Math.random() - 0.5) * maxShift * 2);
                const startY = Math.floor(Math.random() * height);
                const blockHeight = Math.floor(Math.random() * 80 * intensity) + 20;
                
                for (let y = startY; y < Math.min(startY + blockHeight, height); y++) {
                    for (let x = 0; x < width; x++) {
                        const sourceX = (x - shiftAmount + width) % width;
                        const sourceIdx = (y * width + sourceX) * 4;
                        const destIdx = (y * width + x) * 4;
                        
                        imageData.data[destIdx] = imageData.data[sourceIdx];
                        imageData.data[destIdx + 1] = imageData.data[sourceIdx + 1];
                        imageData.data[destIdx + 2] = imageData.data[sourceIdx + 2];
                    }
                }
                
                ctx.putImageData(imageData, 0, 0);
            }
            
            // RGB split
            if (Math.random() < glitchChance * 0.5) {
                const imageData = ctx.getImageData(0, 0, width, height);
                const splitAmount = Math.floor(Math.random() * 10 * intensity) + 5;
                const startY = Math.floor(Math.random() * height);
                const blockHeight = Math.floor(Math.random() * 40) + 10;
                
                for (let y = startY; y < Math.min(startY + blockHeight, height); y++) {
                    for (let x = 0; x < width; x++) {
                        const idx = (y * width + x) * 4;
                        const rIdx = (y * width + Math.min(x + splitAmount, width - 1)) * 4;
                        const bIdx = (y * width + Math.max(x - splitAmount, 0)) * 4;
                        
                        imageData.data[idx] = imageData.data[rIdx];
                        imageData.data[idx + 2] = imageData.data[bIdx + 2];
                    }
                }
                
                ctx.putImageData(imageData, 0, 0);
            }
            
            // Color blocks - more visible
            if (Math.random() < glitchChance * 0.3) {
                ctx.save();
                ctx.globalAlpha = 0.7 * intensity;
                const colors = ['#ff0000', '#00ff00', '#0000ff', '#ff00ff', '#00ffff', '#ffff00'];
                ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
                const blockX = Math.random() * width;
                const blockY = Math.random() * height;
                const blockW = Math.random() * 150 * intensity;
                const blockH = Math.random() * 100 * intensity;
                ctx.fillRect(blockX, blockY, blockW, blockH);
                ctx.restore();
            }
            
            // Vertical tear
            if (Math.random() < glitchChance * 0.2) {
                const x = Math.floor(Math.random() * width);
                const tearWidth = Math.floor(Math.random() * 5) + 1;
                ctx.save();
                ctx.globalAlpha = 0.8;
                ctx.fillStyle = Math.random() > 0.5 ? '#ffffff' : '#000000';
                ctx.fillRect(x, 0, tearWidth, height);
                ctx.restore();
            }
        }
    },
    {
        id: 'worn',
        name: 'Worn Map',
        description: 'Damaged and aged appearance',
        apply: (ctx, width, height, intensity) => {
            ctx.save();
            
            // Add tears and holes
            const damageCount = Math.floor(20 * intensity);
            for (let i = 0; i < damageCount; i++) {
                const x = Math.random() * width;
                const y = Math.random() * height;
                const size = Math.random() * 30 * intensity + 10;
                
                // Random damage shape
                if (Math.random() > 0.5) {
                    // Circular hole
                    ctx.globalCompositeOperation = 'destination-out';
                    const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
                    gradient.addColorStop(0, `rgba(0, 0, 0, ${0.6 * intensity})`);
                    gradient.addColorStop(0.7, `rgba(0, 0, 0, ${0.3 * intensity})`);
                    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
                    ctx.fillStyle = gradient;
                    ctx.beginPath();
                    ctx.arc(x, y, size, 0, Math.PI * 2);
                    ctx.fill();
                } else {
                    // Irregular tear
                    ctx.globalCompositeOperation = 'destination-out';
                    ctx.fillStyle = `rgba(0, 0, 0, ${0.4 * intensity})`;
                    ctx.beginPath();
                    for (let j = 0; j < 6; j++) {
                        const angle = (j / 6) * Math.PI * 2;
                        const r = size * (0.5 + Math.random() * 0.5);
                        const px = x + Math.cos(angle) * r;
                        const py = y + Math.sin(angle) * r;
                        if (j === 0) ctx.moveTo(px, py);
                        else ctx.lineTo(px, py);
                    }
                    ctx.closePath();
                    ctx.fill();
                }
            }
            
            // Add dark stains
            ctx.globalCompositeOperation = 'source-over';
            const stainCount = Math.floor(15 * intensity);
            for (let i = 0; i < stainCount; i++) {
                const x = Math.random() * width;
                const y = Math.random() * height;
                const size = Math.random() * 50 + 20;
                
                const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
                gradient.addColorStop(0, `rgba(60, 40, 20, ${0.3 * intensity})`);
                gradient.addColorStop(1, 'rgba(60, 40, 20, 0)');
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(x, y, size, 0, Math.PI * 2);
                ctx.fill();
            }
            
            // Add scratches
            ctx.strokeStyle = `rgba(100, 80, 60, ${0.3 * intensity})`;
            ctx.lineWidth = 1;
            const scratchCount = Math.floor(10 * intensity);
            for (let i = 0; i < scratchCount; i++) {
                const startX = Math.random() * width;
                const startY = Math.random() * height;
                const endX = startX + (Math.random() - 0.5) * 100;
                const endY = startY + (Math.random() - 0.5) * 100;
                
                ctx.beginPath();
                ctx.moveTo(startX, startY);
                ctx.lineTo(endX, endY);
                ctx.stroke();
            }
            
            // Add fold lines
            ctx.strokeStyle = `rgba(80, 60, 40, ${0.2 * intensity})`;
            ctx.lineWidth = 2;
            const foldCount = Math.floor(3 * intensity);
            for (let i = 0; i < foldCount; i++) {
                if (Math.random() > 0.5) {
                    // Horizontal fold
                    const y = Math.random() * height;
                    ctx.beginPath();
                    ctx.moveTo(0, y);
                    ctx.lineTo(width, y);
                    ctx.stroke();
                } else {
                    // Vertical fold
                    const x = Math.random() * width;
                    ctx.beginPath();
                    ctx.moveTo(x, 0);
                    ctx.lineTo(x, height);
                    ctx.stroke();
                }
            }
            
            ctx.restore();
        }
    }
];

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
 * @param {number} r - Red channel
 * @param {number} g - Green channel
 * @param {number} b - Blue channel
 * @returns {number} Province ID
 */
function calculateProvinceId(r, g, b) {
    return (r << 16) | (g << 8) | b;
}

/**
 * Check if a province ID is valid
 * @param {number} provinceId - Province ID
 * @param {number} r - Red channel
 * @param {number} g - Green channel
 * @param {number} b - Blue channel
 * @returns {boolean} True if valid
 */
function isValidProvince(provinceId, r, g, b) {
    if (provinceId === 0) return false;
    if (r === 0 && g === 0 && b === 0) return false;
    if (r === 255 && g === 255 && b === 255) return false;
    return true;
}

/**
 * Get canvas coordinates from mouse event
 * @param {MouseEvent} event - Mouse event
 * @returns {{canvasX: number, canvasY: number}} Canvas coordinates
 */
function getCanvasCoordinates(event) {
    const rect = visualCanvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const scaleX = baseWidth / rect.width;
    const scaleY = baseHeight / rect.height;
    return {
        canvasX: Math.floor(x * scaleX),
        canvasY: Math.floor(y * scaleY)
    };
}

/**
 * Convert hex to RGB
 * @param {string} hex - Hex color
 * @returns {{r: number, g: number, b: number}} RGB object
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
 * Throttle function
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit
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

// ============================================================================
// LAYERS MANAGEMENT
// ============================================================================

/**
 * Load all available map layers from server
 * @async
 */
async function loadMapLayers() {
    try {
        const response = await fetch('/api/map-layers');
        const data = await response.json();
        
        mapLayers = [];
        
        for (const layerName of data.layers) {
            const img = new Image();
            img.src = `/static/${layerName}`;
            
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
            });
            
            mapLayers.push({
                name: layerName,
                image: img,
                enabled: false,
                opacity: 1.0
            });
        }
        
        renderLayersList();
        console.log('Loaded', mapLayers.length, 'additional layers');
    } catch (error) {
        console.error('Error loading map layers:', error);
    }
}

/**
 * Render layers list UI
 */
function renderLayersList() {
    layersList.innerHTML = '';
    
    if (mapLayers.length === 0) {
        layersList.innerHTML = '<div class="text-xs text-muted-foreground text-center py-4">No additional layers found</div>';
        return;
    }
    
    mapLayers.forEach((layer, index) => {
        const layerDiv = document.createElement('div');
        layerDiv.className = 'layer-card';
        layerDiv.dataset.layerIndex = index;
        
        layerDiv.innerHTML = `
            <div class="flex items-center gap-2 mb-2">
                <div class="text-muted-foreground cursor-move flex-shrink-0" title="Drag to reorder">
                    <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9 5h2v2H9V5zm0 4h2v2H9V9zm0 4h2v2H9v-2zm0 4h2v2H9v-2zm4-12h2v2h-2V5zm0 4h2v2h-2V9zm0 4h2v2h-2v-2zm0 4h2v2h-2v-2z"/>
                    </svg>
                </div>
                <span class="text-xs text-foreground flex-1 truncate">${layer.name.replace('_map.png', '').replace(/_/g, ' ')}</span>
                <button class="toggle-switch ${layer.enabled ? 'active' : ''} flex-shrink-0" data-layer-toggle="${index}">
                    <span class="toggle-indicator"></span>
                </button>
            </div>
            <div class="opacity-control ${layer.enabled ? '' : 'hidden'}" data-layer-opacity="${index}">
                <div class="flex items-center justify-between mb-1">
                    <label class="text-[10px] text-muted-foreground">Opacity</label>
                    <span class="text-[10px] font-mono text-foreground">${Math.round(layer.opacity * 100)}%</span>
                </div>
                <input type="range" min="0" max="100" value="${layer.opacity * 100}" class="w-full" data-layer-slider="${index}">
            </div>
        `;
        
        layersList.appendChild(layerDiv);
    });
    
    // Setup Sortable.js for drag and drop
    new Sortable(layersList, {
        animation: 150,
        handle: '.drag-handle',
        ghostClass: 'sortable-ghost',
        onEnd: (evt) => {
            const oldIndex = evt.oldIndex;
            const newIndex = evt.newIndex;
            const [movedLayer] = mapLayers.splice(oldIndex, 1);
            mapLayers.splice(newIndex, 0, movedLayer);
            redrawMap();
        }
    });
    
    // Add event listeners
    layersList.querySelectorAll('[data-layer-toggle]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.currentTarget.dataset.layerToggle);
            mapLayers[index].enabled = !mapLayers[index].enabled;
            renderLayersList();
            redrawMap();
        });
    });
    
    layersList.querySelectorAll('[data-layer-slider]').forEach(slider => {
        slider.addEventListener('input', (e) => {
            const index = parseInt(e.currentTarget.dataset.layerSlider);
            mapLayers[index].opacity = parseInt(e.currentTarget.value) / 100;
            const opacityDiv = e.currentTarget.parentElement.querySelector('.text-xs');
            opacityDiv.textContent = Math.round(mapLayers[index].opacity * 100) + '%';
            redrawMap();
        });
    });
}

// ============================================================================
// EFFECTS MANAGEMENT
// ============================================================================

/**
 * Render effects list UI
 */
function renderEffectsList() {
    effectsList.innerHTML = '';
    
    AVAILABLE_EFFECTS.forEach(effect => {
        const isActive = activeEffects.find(e => e.name === effect.id);
        
        const effectDiv = document.createElement('div');
        effectDiv.className = `effect-card ${isActive ? 'active' : ''}`;
        
        effectDiv.innerHTML = `
            <div class="flex items-center justify-between mb-2">
                <div class="flex-1 min-w-0">
                    <div class="text-xs font-medium text-foreground truncate">${effect.name}</div>
                    <div class="text-[10px] text-muted-foreground truncate">${effect.description}</div>
                </div>
                <button class="toggle-switch ${isActive ? 'active' : ''} ml-3 flex-shrink-0" data-effect-toggle="${effect.id}">
                    <span class="toggle-indicator"></span>
                </button>
            </div>
            <div class="intensity-control ${isActive ? '' : 'hidden'}" data-effect-intensity="${effect.id}">
                <div class="flex items-center justify-between mb-1">
                    <label class="text-[10px] text-muted-foreground">Intensity</label>
                    <span class="text-[10px] font-mono text-foreground">${isActive ? Math.round(isActive.intensity * 100) : 50}%</span>
                </div>
                <input type="range" min="0" max="100" value="${isActive ? isActive.intensity * 100 : 50}" class="w-full" data-effect-slider="${effect.id}">
            </div>
        `;
        
        effectsList.appendChild(effectDiv);
    });
    
    // Add event listeners
    effectsList.querySelectorAll('[data-effect-toggle]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const effectId = e.currentTarget.dataset.effectToggle;
            const existingIndex = activeEffects.findIndex(e => e.name === effectId);
            
            if (existingIndex >= 0) {
                activeEffects.splice(existingIndex, 1);
                if (activeEffects.length === 0) {
                    stopEffectsAnimation();
                }
            } else {
                activeEffects.push({ name: effectId, enabled: true, intensity: 0.5 });
                if (activeEffects.length === 1) {
                    startEffectsAnimation();
                }
            }
            
            renderEffectsList();
            redrawMap();
        });
    });
    
    effectsList.querySelectorAll('[data-effect-slider]').forEach(slider => {
        slider.addEventListener('input', (e) => {
            const effectId = e.currentTarget.dataset.effectSlider;
            const effect = activeEffects.find(e => e.name === effectId);
            if (effect) {
                effect.intensity = parseInt(e.currentTarget.value) / 100;
                const intensityDiv = e.currentTarget.parentElement.querySelector('.text-xs');
                intensityDiv.textContent = Math.round(effect.intensity * 100) + '%';
                redrawMap();
            }
        });
    });
}

// ============================================================================
// MAP INITIALIZATION
// ============================================================================

/**
 * Initialize maps
 */
function initializeMaps() {
    baseWidth = visualImg.width;
    baseHeight = visualImg.height;
    visualCanvas.width = baseWidth;
    visualCanvas.height = baseHeight;
    
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
    
    loadMapLayers();
    renderEffectsList();
}

/**
 * Pre-compute province data
 */
function precomputeProvinceData() {
    const imageData = dataCtx.getImageData(0, 0, dataCanvas.width, dataCanvas.height);
    const data = imageData.data;
    
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
    
    for (const [provinceId, pixels] of provincePixelsMap.entries()) {
        const fillPixels = pixels.map(p => ({ x: p.x, y: p.y }));
        
        provincePixelCache.set(provinceId, {
            fill: fillPixels,
            outline: null,
            _rawPixels: pixels,
            _imageData: data
        });
    }
    
    buildProvinceLookupGrid(imageData);
}

/**
 * Build spatial lookup grid
 * @param {ImageData} imageData - Image data
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
 * Get province at position
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @returns {number|null} Province ID
 */
function getProvinceAtPosition(x, y) {
    if (x < 0 || x >= dataCanvas.width || y < 0 || y >= dataCanvas.height) {
        return null;
    }
    const index = y * dataCanvas.width + x;
    return provinceLookupGrid[index];
}

/**
 * Compute border pixels
 * @param {Array} pixels - Province pixels
 * @param {Uint8ClampedArray} data - Image data
 * @param {number} provinceId - Province ID
 * @returns {Array} Border pixels
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
 * Get province border pixels
 * @param {number} provinceId - Province ID
 * @returns {Array} Border pixels
 */
function getProvinceBorderPixels(provinceId) {
    const cached = provincePixelCache.get(provinceId);
    if (!cached) return [];
    
    if (cached.outline === null) {
        cached.outline = computeBorderPixels(cached._rawPixels, cached._imageData, provinceId);
        delete cached._rawPixels;
        delete cached._imageData;
    }
    
    return cached.outline;
}

/**
 * Expand border pixels
 * @param {Array} borderPixels - Border pixels
 * @param {number} thickness - Thickness
 * @returns {Array} Expanded pixels
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

// ============================================================================
// DRAWING FUNCTIONS
// ============================================================================

/**
 * Draw visual map
 */
function drawVisualMap() {
    visualCtx.clearRect(0, 0, visualCanvas.width, visualCanvas.height);
    visualCtx.save();
    visualCtx.globalAlpha = visualOpacity;
    visualCtx.drawImage(visualImg, 0, 0);
    visualCtx.restore();
}

/**
 * Draw map layers
 */
function drawMapLayers() {
    mapLayers.forEach(layer => {
        if (layer.enabled) {
            visualCtx.save();
            visualCtx.globalAlpha = layer.opacity;
            visualCtx.drawImage(layer.image, 0, 0);
            visualCtx.restore();
        }
    });
}

/**
 * Apply visual effects
 */
function applyVisualEffects() {
    if (activeEffects.length === 0) return;
    
    // Copy to effect canvas
    effectCtx.clearRect(0, 0, effectCanvas.width, effectCanvas.height);
    effectCtx.drawImage(visualCanvas, 0, 0);
    
    // Apply each effect
    activeEffects.forEach(activeEffect => {
        const effectConfig = AVAILABLE_EFFECTS.find(e => e.id === activeEffect.name);
        if (effectConfig && activeEffect.enabled) {
            effectConfig.apply(
                effectCtx,
                effectCanvas.width,
                effectCanvas.height,
                activeEffect.intensity,
                animationTime,
                currentMouseX,
                currentMouseY
            );
        }
    });
    
    // Draw back
    visualCtx.clearRect(0, 0, visualCanvas.width, visualCanvas.height);
    visualCtx.drawImage(effectCanvas, 0, 0);
}

/**
 * Get cached province canvas
 * @param {number} provinceId - Province ID
 * @param {string} mode - Mode
 * @param {string} color - Color
 * @param {number} thickness - Thickness
 * @returns {HTMLCanvasElement|null} Canvas
 */
function getCachedProvinceCanvas(provinceId, mode, color, thickness) {
    const cacheKey = `${provinceId}-${mode}-${color}-${thickness}`;
    
    if (provinceCanvasCache.has(cacheKey)) {
        return provinceCanvasCache.get(cacheKey);
    }
    
    const cached = provincePixelCache.get(provinceId);
    if (!cached) return null;
    
    let pixels;
    if (mode === 'outline') {
        const baseOutline = getProvinceBorderPixels(provinceId);
        pixels = expandBorderPixels(baseOutline, thickness);
    } else {
        pixels = cached.fill;
    }
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = dataCanvas.width;
    tempCanvas.height = dataCanvas.height;
    const tempCtx = tempCanvas.getContext('2d', { alpha: true, willReadFrequently: false });
    const tempImageData = tempCtx.createImageData(tempCanvas.width, tempCanvas.height);
    const tempData = tempImageData.data;
    
    const rgb = mode === 'outline' ? hexToRgb(color) : { r: 255, g: 255, b: 100 };
    
    for (const { x, y } of pixels) {
        const i = (y * tempCanvas.width + x) * 4;
        tempData[i] = rgb.r;
        tempData[i + 1] = rgb.g;
        tempData[i + 2] = rgb.b;
        tempData[i + 3] = 255;
    }
    
    tempCtx.putImageData(tempImageData, 0, 0);
    
    if (provinceCanvasCache.size < MAX_CANVAS_CACHE_SIZE) {
        provinceCanvasCache.set(cacheKey, tempCanvas);
    }
    
    return tempCanvas;
}

/**
 * Draw province highlight
 * @param {number} provinceId - Province ID
 * @param {string} type - Type
 * @param {number} opacityMultiplier - Opacity multiplier
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
 * Redraw entire map
 */
function redrawMap() {
    if (!originalImageData) return;
    
    drawVisualMap();
    drawMapLayers();
    
    const currentOpacity = pulseEnabled ? getPulseOpacity() : 1.0;
    
    selectedProvinceIds.forEach(provinceId => {
        drawProvinceHighlight(provinceId, 'selected', currentOpacity);
    });
    
    if (currentHoveredProvinceId !== null && !selectedProvinceIds.has(currentHoveredProvinceId)) {
        drawProvinceHighlight(currentHoveredProvinceId, 'hover', currentOpacity);
    }
    
    applyVisualEffects();
}

/**
 * Get pulse opacity
 * @returns {number} Opacity
 */
function getPulseOpacity() {
    return 0.5 + 0.5 * Math.sin(pulsePhase);
}

/**
 * Start effects animation
 */
function startEffectsAnimation() {
    if (effectsAnimationFrame) return;
    
    let lastTime = performance.now();
    
    function animate(currentTime) {
        const deltaTime = currentTime - lastTime;
        
        if (deltaTime >= 33) { // ~30fps
            lastTime = currentTime;
            animationTime = currentTime / 1000;
            
            if (pulseEnabled) {
                pulsePhase += 0.05;
            }
            
            redrawMap();
            
            // Update FPS counter
            frameCount++;
            if (currentTime - lastFpsUpdate >= 1000) {
                currentFps = frameCount;
                frameCount = 0;
                lastFpsUpdate = currentTime;
                updateFpsDisplay();
            }
        }
        
        effectsAnimationFrame = requestAnimationFrame(animate);
    }
    
    animate(performance.now());
}

/**
 * Update FPS display with color coding
 */
function updateFpsDisplay() {
    fpsCounter.textContent = `${currentFps} FPS`;
    fpsCounter.classList.remove('warning', 'critical');
    
    if (currentFps < 20) {
        fpsCounter.classList.add('critical');
    } else if (currentFps < 25) {
        fpsCounter.classList.add('warning');
    }
}


/**
 * Stop effects animation
 */
function stopEffectsAnimation() {
    if (effectsAnimationFrame) {
        cancelAnimationFrame(effectsAnimationFrame);
        effectsAnimationFrame = null;
        animationTime = 0;
    }
}

/**
 * Clear province canvas cache
 */
function clearProvinceCanvasCache() {
    provinceCanvasCache.clear();
}

// ============================================================================
// ZOOM AND PAN
// ============================================================================

/**
 * Update canvas transform
 */
function updateCanvasTransform() {
    visualCanvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomLevel})`;
    visualCanvas.style.width = (baseWidth * zoomLevel) + 'px';
    visualCanvas.style.height = (baseHeight * zoomLevel) + 'px';
    zoomInfo.textContent = `${Math.round(zoomLevel * 100)}%`;
}

/**
 * Zoom in
 */
function zoomIn() {
    zoomLevel = Math.min(zoomLevel * 1.2, 5.0);
    updateCanvasTransform();
    redrawMap();
}

/**
 * Zoom out
 */
function zoomOut() {
    zoomLevel = Math.max(zoomLevel / 1.2, 0.2);
    updateCanvasTransform();
    redrawMap();
}

/**
 * Reset zoom
 */
function zoomReset() {
    zoomLevel = 1.0;
    panX = 0;
    panY = 0;
    updateCanvasTransform();
    redrawMap();
}

// ============================================================================
// SELECTED PROVINCES DISPLAY
// ============================================================================

/**
 * Update selected provinces panel
 */
function updateSelectedProvincesPanel() {
    if (selectedProvinceIds.size === 0) {
        selectedProvincesPanel.classList.add('hidden');
        return;
    }
    
    selectedProvincesPanel.classList.remove('hidden');
    selectedProvincesList.innerHTML = '';
    
    selectedProvinceIds.forEach(provinceId => {
        const provinceData = provincesData[provinceId.toString()];
        
        const provinceDiv = document.createElement('div');
        provinceDiv.className = 'province-card';
        
        let content = `
            <div class="flex items-start justify-between mb-3">
                <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium text-foreground truncate">${provinceData?.name || 'Unknown Province'}</div>
                    <div class="text-xs text-muted-foreground font-mono">ID: ${provinceId}</div>
                </div>
                <button class="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none ml-2" data-remove-province="${provinceId}">×</button>
            </div>
        `;
        
        if (provinceData) {
            content += '<div class="space-y-1.5 text-xs">';
            
            if (provinceData.owner) {
                content += `<div class="flex justify-between items-center gap-4"><span class="text-muted-foreground">Owner</span><span class="text-foreground font-medium">${provinceData.owner}</span></div>`;
            }
            if (provinceData.type) {
                content += `<div class="flex justify-between items-center gap-4"><span class="text-muted-foreground">Type</span><span class="text-foreground">${provinceData.type}</span></div>`;
            }
            if (provinceData.development !== undefined) {
                content += `<div class="flex justify-between items-center gap-4"><span class="text-muted-foreground">Development</span><span class="text-foreground font-mono">${provinceData.development}</span></div>`;
            }
            if (provinceData.trade_goods) {
                content += `<div class="flex justify-between items-center gap-4"><span class="text-muted-foreground">Trade Goods</span><span class="text-foreground">${provinceData.trade_goods}</span></div>`;
            }
            if (provinceData.terrain) {
                content += `<div class="flex justify-between items-center gap-4"><span class="text-muted-foreground">Terrain</span><span class="text-foreground">${provinceData.terrain}</span></div>`;
            }
            
            content += '</div>';
            
            if (provinceData.description) {
                content += `<div class="mt-3 pt-3 border-t border-border text-xs text-muted-foreground italic">${provinceData.description}</div>`;
            }
        }
        
        provinceDiv.innerHTML = content;
        selectedProvincesList.appendChild(provinceDiv);
    });
    
    // Add remove listeners
    selectedProvincesList.querySelectorAll('[data-remove-province]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const provinceId = parseInt(e.currentTarget.dataset.removeProvince);
            selectedProvinceIds.delete(provinceId);
            updateSelectedProvincesPanel();
            redrawMap();
        });
    });
}

// ============================================================================
// TOOLTIP
// ============================================================================

/**
 * Show tooltip
 * @param {MouseEvent} event - Mouse event
 * @param {number} provinceId - Province ID
 * @param {Object} provinceData - Province data
 */
function showTooltip(event, provinceId, provinceData) {
    let content = '';
    
    if (provinceData) {
        content += `<div class="text-sm font-medium text-zinc-100 mb-2">${provinceData.name || 'Unknown'}</div>`;
        content += `<div class="text-xs text-zinc-500 font-mono mb-2">ID: ${provinceId}</div>`;
        
        if (provinceData.owner || provinceData.type) {
            content += '<div class="space-y-1 text-xs">';
            if (provinceData.owner) {
                content += `<div class="flex justify-between gap-3"><span class="text-zinc-500">Owner</span><span class="text-zinc-300">${provinceData.owner}</span></div>`;
            }
            if (provinceData.type) {
                content += `<div class="flex justify-between gap-3"><span class="text-zinc-500">Type</span><span class="text-zinc-300">${provinceData.type}</span></div>`;
            }
            content += '</div>';
        }
    } else {
        content += `<div class="text-sm font-medium text-zinc-100">Province ${provinceId}</div>`;
        content += `<div class="text-xs text-zinc-500 mt-1">No data available</div>`;
    }
    
    tooltipContent.innerHTML = content;
    tooltip.classList.remove('hidden');
    positionTooltip(event);
}

/**
 * Position tooltip
 * @param {MouseEvent} event - Mouse event
 */
function positionTooltip(event) {
    const x = event.clientX;
    const y = event.clientY;
    const tooltipWidth = tooltip.offsetWidth;
    const tooltipHeight = tooltip.offsetHeight;
    const offsetX = 12;
    const offsetY = 12;
    
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
}

// ============================================================================
// PROVINCE DATA
// ============================================================================

/**
 * Load provinces data
 * @async
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
// EVENT HANDLERS
// ============================================================================

const handleMouseMove = throttle(function(event) {
    const { canvasX, canvasY } = getCanvasCoordinates(event);
    currentMouseX = canvasX;
    currentMouseY = canvasY;
    
    document.getElementById('mousePos').textContent = `(${canvasX}, ${canvasY})`;
    
    if (mapsLoaded === totalMaps && canvasX >= 0 && canvasX < dataCanvas.width && canvasY >= 0 && canvasY < dataCanvas.height) {
        const provinceId = getProvinceAtPosition(canvasX, canvasY);
        document.getElementById('provinceId').textContent = `ID: ${provinceId}`;
        
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
            positionTooltip(event);
        }
    } else {
        if (currentHoveredProvinceId !== null) {
            currentHoveredProvinceId = null;
            redrawMap();
        }
        hideTooltip();
    }
}, 16);

function handleMouseLeave() {
    currentHoveredProvinceId = null;
    currentMouseX = null;
    currentMouseY = null;
    redrawMap();
    hideTooltip();
}

function handleClick(event) {
    if (isDragging) return;
    
    const { canvasX, canvasY } = getCanvasCoordinates(event);
    
    if (mapsLoaded === totalMaps && canvasX >= 0 && canvasX < dataCanvas.width && canvasY >= 0 && canvasY < dataCanvas.height) {
        const provinceId = getProvinceAtPosition(canvasX, canvasY);
        
        if (!provincePixelCache.has(provinceId)) {
            selectedProvinceIds.clear();
            updateSelectedProvincesPanel();
            redrawMap();
            return;
        }
        
        if (event.shiftKey) {
            if (selectedProvinceIds.has(provinceId)) {
                selectedProvinceIds.delete(provinceId);
            } else {
                selectedProvinceIds.add(provinceId);
            }
        } else {
            selectedProvinceIds.clear();
            selectedProvinceIds.add(provinceId);
        }
        
        updateSelectedProvincesPanel();
        redrawMap();
    }
}

function handleWheel(event) {
    event.preventDefault();
    const delta = event.deltaY > 0 ? 0.9 : 1.1;
    zoomLevel = Math.max(0.2, Math.min(5.0, zoomLevel * delta));
    updateCanvasTransform();
    redrawMap();
}

function handleMouseDown(event) {
    if (event.button === 0) {
        isDragging = true;
        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
        mapWrapper.style.cursor = 'grabbing';
    }
}

function handleGlobalMouseMove(event) {
    if (isDragging) {
        panX += event.clientX - lastMouseX;
        panY += event.clientY - lastMouseY;
        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
        updateCanvasTransform();
    }
}

function handleMouseUp() {
    if (isDragging) {
        isDragging = false;
        mapWrapper.style.cursor = '';
    }
}

// ============================================================================
// CONTROL HANDLERS
// ============================================================================

function handleVisualOpacityChange(e) {
    visualOpacity = parseInt(e.target.value) / 100;
    visualOpacityValue.textContent = Math.round(visualOpacity * 100) + '%';
    redrawMap();
}

function handleHighlightOpacityChange(e) {
    highlightOpacity = parseInt(e.target.value) / 100;
    highlightOpacityValue.textContent = Math.round(highlightOpacity * 100) + '%';
    redrawMap();
}

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

function handleOutlineColorChange(e) {
    outlineColorValue = e.target.value;
    outlineColorText.value = outlineColorValue;
    clearProvinceCanvasCache();
    redrawMap();
}

function handleOutlineColorTextChange(e) {
    const value = e.target.value;
    if (/^#[0-9A-F]{6}$/i.test(value)) {
        outlineColorValue = value;
        outlineColor.value = value;
        clearProvinceCanvasCache();
        redrawMap();
    }
}

function handleOutlineThicknessChange(e) {
    outlineThicknessValue = parseInt(e.target.value);
    outlineThicknessValueObj.textContent = `${outlineThicknessValue}px`;
    clearProvinceCanvasCache();
    redrawMap();
}

function handlePulseToggle() {
    pulseEnabled = !pulseEnabled;
    
    if (pulseEnabled) {
        pulseToggle.classList.add('active');
        pulseToggle.classList.remove('inactive');
        pulseToggleIndicator.classList.add('active');
        pulseToggleIndicator.classList.remove('inactive');
        
        if (activeEffects.length === 0) {
            startEffectsAnimation();
        }
    } else {
        pulseToggle.classList.remove('active');
        pulseToggle.classList.add('inactive');
        pulseToggleIndicator.classList.remove('active');
        pulseToggleIndicator.classList.add('inactive');
        pulsePhase = 0;
        
        if (activeEffects.length === 0) {
            stopEffectsAnimation();
        }
        
        redrawMap();
    }
}

function handleClearSelection() {
    selectedProvinceIds.clear();
    updateSelectedProvincesPanel();
    redrawMap();
}

// ============================================================================
// EVENT LISTENER SETUP
// ============================================================================

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
    
    clearSelectionBtn.addEventListener('click', handleClearSelection);
    refreshLayersBtn.addEventListener('click', loadMapLayers);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function init() {
    setupEventListeners();
    loadProvincesData();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}