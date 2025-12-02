// --- 1. IMPORTS ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// --- 2. YOUR REAL CONFIG (BAKED IN) ---
const firebaseConfig = {
    apiKey: "AIzaSyB-fZTbZqNOJyPZhtnT8v0EiRb5XhCFzP0",
    authDomain: "gem-edit.firebaseapp.com",
    projectId: "gem-edit",
    storageBucket: "gem-edit.firebasestorage.app",
    messagingSenderId: "586824444534",
    appId: "1:586824444534:web:4fe781be673c7edcfb8d57",
    measurementId: "G-BTCENT5HEK"
};

// --- 3. INIT ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// --- 4. AUTH & ROUTING ---
const els = {
    auth: document.getElementById('auth-screen'),
    dash: document.getElementById('dashboard'),
    editor: document.getElementById('editor'),
    loginBtn: document.getElementById('google-login-btn'),
    logoutBtn: document.getElementById('logout-btn'),
    dashUser: document.getElementById('dash-user-name'),
    newProjectBtn: document.getElementById('new-project-btn'),
    backToDashBtn: document.getElementById('back-to-dash-btn')
};

// Login
if (els.loginBtn) {
    els.loginBtn.addEventListener('click', () => {
        signInWithPopup(auth, provider).catch(err => alert("Login Error: " + err.message));
    });
}

// Logout
if (els.logoutBtn) {
    els.logoutBtn.addEventListener('click', () => {
        signOut(auth).then(() => location.reload());
    });
}

// Auth Listener
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Show Dashboard
        if(els.auth) els.auth.classList.add('hidden');
        if(els.dash) els.dash.classList.remove('hidden');
        if(els.dashUser) els.dashUser.textContent = user.displayName;
    } else {
        // Show Login
        if(els.auth) els.auth.classList.remove('hidden');
        if(els.dash) els.dash.classList.add('hidden');
        if(els.editor) els.editor.classList.add('hidden');
    }
});

// Navigation
if (els.newProjectBtn) {
    els.newProjectBtn.addEventListener('click', () => {
        els.dash.classList.add('hidden');
        els.editor.classList.remove('hidden');
    });
}

if (els.backToDashBtn) {
    els.backToDashBtn.addEventListener('click', () => {
        els.editor.classList.add('hidden');
        els.dash.classList.remove('hidden');
    });
}

// --- 5. LAYER SYSTEM ---
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-upload');
const stage = document.getElementById('canvas-stage');
let selectedElement = null;

if (dropZone && fileInput) {
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        Array.from(e.target.files).forEach(f => {
            const url = URL.createObjectURL(f);
            createLayer(url, f.type.includes('video') ? 'video' : 'image');
        });
    });
}

function createLayer(url, type) {
    if (!stage) return;

    // Container
    const container = document.createElement('div');
    container.className = 'layer-element';
    container.style.width = '400px';
    container.style.top = '100px'; 
    container.style.left = '100px';
    
    // Media Content
    const content = document.createElement(type === 'video' ? 'video' : 'img');
    content.src = url;
    content.style.width = '100%'; 
    content.style.height = '100%'; 
    content.style.objectFit = 'contain'; // Better for resizing
    
    if(type === 'video') { 
        content.loop = true; 
        content.muted = true; 
        content.play(); 
    }
    
    container.appendChild(content);
    stage.appendChild(container);

    makeDraggable(container);
    container.addEventListener('mousedown', (e) => { 
        e.stopPropagation(); 
        selectLayer(container); 
    });
    
    selectLayer(container);
}

// --- 6. PROPERTIES & EFFECTS ENGINE ---
function selectLayer(el) {
    selectedElement = el;
    document.querySelectorAll('.layer-element').forEach(e => e.classList.remove('selected'));
    el.classList.add('selected');

    const panel = document.getElementById('prop-panel-content');
    const template = document.getElementById('layer-props-template');
    
    if (!panel || !template) return;

    panel.innerHTML = '';
    panel.appendChild(template.content.cloneNode(true));

    const contentEl = el.querySelector('img, video'); 

    // 1. Bind Number Inputs (W/H)
    panel.querySelectorAll('.prop-num-input').forEach(input => {
        const prop = input.dataset.prop;
        // Get computed style initially
        input.value = parseInt(el.style[prop] || el.getBoundingClientRect()[prop]); 
        
        input.addEventListener('input', (e) => {
            el.style[prop] = e.target.value + 'px';
        });
    });

    // 2. Bind Sliders
    panel.querySelectorAll('.prop-slider').forEach(slider => {
        const prop = slider.dataset.prop;
        const filter = slider.dataset.filter;

        // Init Values
        if(prop === 'scale') slider.value = el.dataset.scale || 1;
        if(prop === 'opacity') slider.value = (el.style.opacity || 1) * 100;
        
        // Init Filters
        if(filter) {
            slider.value = contentEl.dataset[filter] || (filter === 'contrast' || filter === 'brightness' ? 100 : 0);
        }

        slider.addEventListener('input', (e) => {
            const val = e.target.value;
            // Update Text Display
            const display = e.target.previousElementSibling.querySelector('.val-display');
            if(display) display.innerText = val + (filter ? (filter === 'blur' ? 'px' : '%') : '');
            
            if(prop) applyTransform(el, prop, val);
            if(filter) applyFilter(contentEl, filter, val);
        });
    });

    // 3. Bind Actions
    const splitBtn = panel.querySelector('[data-action="split"]');
    if(splitBtn) splitBtn.addEventListener('click', () => splitLayer(el));
    
    const delBtn = panel.querySelector('[data-action="delete"]');
    if(delBtn) delBtn.addEventListener('click', () => {
        el.remove();
        panel.innerHTML = '<p class="empty-state">Select a layer to edit</p>';
    });
}

function applyTransform(el, prop, val) {
    if(prop === 'opacity') el.style.opacity = val / 100;
    if(prop === 'scale') {
        el.dataset.scale = val;
        el.style.transform = `scale(${val})`;
    }
}

function applyFilter(contentEl, filterName, val) {
    // Save state
    contentEl.dataset[filterName] = val;

    // Build filter string
    const filters = [
        `blur(${contentEl.dataset.blur || 0}px)`,
        `grayscale(${contentEl.dataset.grayscale || 0}%)`,
        `sepia(${contentEl.dataset.sepia || 0}%)`,
        `invert(${contentEl.dataset.invert || 0}%)`,
        `contrast(${contentEl.dataset.contrast || 100}%)`
    ];
    
    contentEl.style.filter = filters.join(' ');
}

// SPLICING
function splitLayer(el) {
    const rect = el.getBoundingClientRect();
    const currentWidth = rect.width;
    const newWidth = currentWidth / 2;
    
    el.style.width = newWidth + 'px';
    
    const clone = el.cloneNode(true);
    const currentLeft = parseInt(el.style.left || 0);
    
    clone.style.left = (currentLeft + newWidth + 20) + 'px';
    clone.style.width = newWidth + 'px';
    
    // Make clone interactive
    stage.appendChild(clone);
    makeDraggable(clone);
    clone.addEventListener('mousedown', (e) => { e.stopPropagation(); selectLayer(clone); });
    
    selectLayer(clone);
}

// --- 7. SCRUBBER ---
const scrubber = document.getElementById('scrubber');
const timeDisplay = document.getElementById('time-display');
let isPlaying = false; 
let playInterval;

const playBtn = document.getElementById('play-btn');
const stopBtn = document.getElementById('stop-btn');

if (playBtn && stopBtn && scrubber) {
    playBtn.addEventListener('click', () => {
        if(isPlaying) return;
        isPlaying = true;
        playInterval = setInterval(() => {
            let val = parseInt(scrubber.value);
            if(val >= 100) val = 0;
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
    // Visual playhead
    const track = document.querySelector('.timeline-track-container');
    if(track) track.style.setProperty('--seek-pos', val + '%');
    
    // Time Text
    const totalSeconds = Math.floor((val / 100) * 60);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    if(timeDisplay) timeDisplay.textContent = `00:${m < 10 ? '0'+m : m}:${s < 10 ? '0'+s : s}`;
}

// --- 8. PHYSICS ---
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
