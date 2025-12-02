// --- 1. IMPORTS ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// --- 2. YOUR CONFIG (Hardcoded & Ready) ---
const firebaseConfig = {
    apiKey: "AIzaSyB-fZTbZqNOJyPZhtnT8v0EiRb5XhCFzP0",
    authDomain: "gem-edit.firebaseapp.com",
    projectId: "gem-edit",
    storageBucket: "gem-edit.firebasestorage.app",
    messagingSenderId: "586824444534",
    appId: "1:586824444534:web:4fe781be673c7edcfb8d57",
    measurementId: "G-BTCENT5HEK"
};

// --- 3. INITIALIZE APP ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// --- 4. AUTHENTICATION ---
const els = {
    auth: document.getElementById('auth-screen'),
    app: document.getElementById('app'),
    loginBtn: document.getElementById('google-login-btn'),
    logoutBtn: document.getElementById('logout-btn'),
    userName: document.getElementById('user-name'),
    userPfp: document.getElementById('user-pfp')
};

// Login
if(els.loginBtn) {
    els.loginBtn.addEventListener('click', () => {
        signInWithPopup(auth, provider).catch(err => alert("Login Error: " + err.message));
    });
}

// Logout
if(els.logoutBtn) {
    els.logoutBtn.addEventListener('click', () => {
        signOut(auth).then(() => location.reload());
    });
}

// Auth State Listener
onAuthStateChanged(auth, (user) => {
    if (user) {
        if(els.auth) els.auth.classList.add('hidden');
        if(els.app) els.app.classList.remove('hidden');
        if(els.userName) els.userName.textContent = user.displayName;
        if(els.userPfp) els.userPfp.src = user.photoURL;
    } else {
        if(els.auth) els.auth.classList.remove('hidden');
        if(els.app) els.app.classList.add('hidden');
    }
});

// --- 5. TABS & URL IMPORTER ---
document.querySelectorAll('.tab').forEach(t => {
    t.addEventListener('click', () => {
        document.querySelectorAll('.tab, .tab-content').forEach(e => e.classList.remove('active'));
        t.classList.add('active');
        const target = document.getElementById(`tab-${t.dataset.tab}`);
        if(target) target.classList.add('active');
    });
});

const urlBtn = document.getElementById('url-add-btn');
if(urlBtn) {
    urlBtn.addEventListener('click', () => {
        const url = document.getElementById('url-input').value;
        if(url) createLayer(url, 'image');
    });
}

// --- 6. LAYER SYSTEM (The Engine) ---
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-upload');
const stage = document.getElementById('canvas-stage');

if(dropZone && fileInput) {
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        Array.from(e.target.files).forEach(f => {
            const url = URL.createObjectURL(f);
            createLayer(url, f.type.includes('video') ? 'video' : 'image');
        });
    });
}

// Global function to create layers
window.createLayer = function(url, type) {
    if(!stage) return;
    
    const el = document.createElement(type === 'video' ? 'video' : 'img');
    el.src = url;
    el.className = 'layer-element';
    
    // Default Dimensions & Pos
    el.style.width = '400px';
    el.style.top = '100px'; 
    el.style.left = '100px';
    el.style.opacity = '1';
    el.style.transition = 'opacity 0.2s, transform 0.1s'; // Smooth changes

    // Video Auto-play
    if(type === 'video') { 
        el.loop = true; 
        el.muted = true; 
        el.play(); 
    }

    // Add Interactions
    makeDraggable(el);
    el.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        selectLayer(el);
    });

    stage.appendChild(el);
    selectLayer(el); 
};

// --- 7. PROPERTIES & EFFECTS ---
let selectedElement = null;

function selectLayer(el) {
    selectedElement = el;
    document.querySelectorAll('.layer-element').forEach(e => e.classList.remove('selected'));
    el.classList.add('selected');

    const content = document.getElementById('prop-panel-content');
    const template = document.getElementById('layer-props-template');
    
    if(!content || !template) return;

    content.innerHTML = '';
    content.appendChild(template.content.cloneNode(true));

    // --- BIND SLIDERS ---
    content.querySelectorAll('.prop-slider').forEach(slider => {
        const prop = slider.dataset.prop;
        
        // Load initial values
        if(prop === 'opacity') slider.value = (el.style.opacity || 1) * 100;
        if(prop === 'scale') {
            const match = el.style.transform.match(/scale\(([^)]+)\)/);
            slider.value = match ? match[1] : 1;
        }

        // Handle Input
        slider.addEventListener('input', (e) => {
            const val = e.target.value;
            // Update Text Display
            const display = e.target.previousElementSibling.querySelector('.val-display');
            if(display) display.textContent = val + (prop === 'blur' || prop === 'pixelate' ? 'px' : '%');
            
            applyEffects(el, prop, val);
        });
    });

    // --- BIND BUTTONS (Split, Fade) ---
    content.querySelectorAll('.action-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            if(action === 'split') splitLayer(el);
            if(action === 'fade-in') { 
                el.style.opacity = '0'; 
                setTimeout(() => el.style.opacity = '1', 50); // Trigger CSS transition
            }
            if(action === 'fade-out') el.style.opacity = '0';
        });
    });
}

function applyEffects(el, prop, val) {
    // Save state to data attributes so we don't overwrite other filters
    if(prop === 'blur') el.dataset.blur = val;
    if(prop === 'pixelate') el.dataset.pixel = val;

    // Retrieve current state (or default to 0)
    const blurVal = el.dataset.blur || 0;
    const pixVal = el.dataset.pixel || 0;

    // 1. Apply Filters
    let filterString = `blur(${blurVal}px)`;
    
    // Pixelate Logic (Using the SVG filter in index.html)
    if(pixVal > 0) {
        filterString += ` url(#pixelate)`;
        // Update the global SVG filter radius to match slider
        const svgFilter = document.querySelector('#pixelate feMorphology');
        if(svgFilter) svgFilter.setAttribute('radius', pixVal);
    }
    
    el.style.filter = filterString;

    // 2. Apply Transforms/Opacity
    if(prop === 'opacity') el.style.opacity = val / 100;
    if(prop === 'scale') {
        // Maintain position, update scale
        // Note: In a real app we'd need complex matrix math, here we simplify
        const currentTransform = el.style.transform.replace(/scale\([^)]+\)/, ''); 
        el.style.transform = `${currentTransform} scale(${val})`;
    }
}

// --- 8. SPLICING TOOL ---
function splitLayer(el) {
    const rect = el.getBoundingClientRect();
    const parentRect = stage.getBoundingClientRect();
    
    // Calculate width to cut
    const currentWidth = rect.width;
    const newWidth = currentWidth / 2;
    
    el.style.width = newWidth + 'px'; // Shrink original
    
    // Create the "Second Half"
    const clone = el.cloneNode(true);
    
    // Calculate relative position for the clone
    // We need to parse 'left' style which is typically "100px"
    const currentLeft = parseInt(el.style.left || 0);
    const newLeft = currentLeft + newWidth + 20; // +20px gap
    
    clone.style.left = newLeft + 'px';
    clone.style.width = newWidth + 'px';
    
    // Re-bind events to clone
    makeDraggable(clone);
    clone.addEventListener('mousedown', (e) => { 
        e.stopPropagation(); 
        selectLayer(clone); 
    });
    
    stage.appendChild(clone);
    // Visual feedback
    clone.style.outline = "2px solid white";
    setTimeout(() => clone.style.outline = "none", 200);
}

// --- 9. SCRUBBER & TIMELINE ---
const scrubber = document.getElementById('scrubber');
const timeDisplay = document.getElementById('time-display');
let isPlaying = false;
let playInterval;

const playBtn = document.getElementById('play-btn');
const stopBtn = document.getElementById('stop-btn');

if(playBtn && stopBtn && scrubber) {
    playBtn.addEventListener('click', () => {
        if(isPlaying) return;
        isPlaying = true;
        // Simple loop to move scrubber
        playInterval = setInterval(() => {
            let val = parseInt(scrubber.value);
            if(val >= 100) val = 0; // Loop
            scrubber.value = val + 1;
            updateTime(scrubber.value);
        }, 100); 
    });

    stopBtn.addEventListener('click', () => {
        isPlaying = false;
        clearInterval(playInterval);
    });

    scrubber.addEventListener('input', (e) => updateTime(e.target.value));
}

function updateTime(val) {
    // Fake time calculation: 0-100 scrub = 0-60 seconds
    const totalSeconds = Math.floor((val / 100) * 60);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    if(timeDisplay) timeDisplay.textContent = `00:${m < 10 ? '0'+m : m}:${s < 10 ? '0'+s : s}`;
}

// --- 10. DRAGGABLE PHYSICS ---
function makeDraggable(element) {
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    element.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        initialLeft = element.offsetLeft;
        initialTop = element.offsetTop;
        element.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        element.style.left = `${initialLeft + dx}px`;
        element.style.top = `${initialTop + dy}px`;
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
        element.style.cursor = 'grab';
    });
}
