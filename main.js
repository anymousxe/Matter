// --- 1. IMPORTS (Auth + Firestore Database) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// --- 2. CONFIG (PASTE YOUR KEYS HERE) ---
const firebaseConfig = {
    apiKey: "PASTE_API_KEY_HERE",
    authDomain: "PASTE_AUTH_DOMAIN_HERE",
    projectId: "PASTE_PROJECT_ID_HERE",
    storageBucket: "PASTE_STORAGE_BUCKET_HERE",
    messagingSenderId: "...",
    appId: "..."
};

// --- 3. INITIALIZATION ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app); // Database
const provider = new GoogleAuthProvider();

// Global State
let currentUser = null;
let currentProjectId = null;
let selectedElement = null;

// --- 4. AUTH & NAVIGATION ---
const els = {
    auth: document.getElementById('auth-screen'),
    dash: document.getElementById('dashboard'),
    editor: document.getElementById('editor'),
    loginBtn: document.getElementById('google-login-btn'),
    logoutBtn: document.getElementById('logout-btn-dash'),
    dashName: document.getElementById('dash-name'),
    dashPfp: document.getElementById('dash-pfp')
};

// Login
els.loginBtn.addEventListener('click', () => {
    signInWithPopup(auth, provider).catch(e => alert(e.message));
});

// Logout
els.logoutBtn.addEventListener('click', () => {
    signOut(auth).then(() => location.reload());
});

// Auth Listener (The Router)
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        els.auth.classList.add('hidden');
        els.dash.classList.remove('hidden');
        
        // Update Dashboard Info
        els.dashName.textContent = user.displayName;
        els.dashPfp.src = user.photoURL;
        
        loadProjects(); // Load projects from DB
    } else {
        els.auth.classList.remove('hidden');
        els.dash.classList.add('hidden');
        els.editor.classList.add('hidden');
    }
});

// --- 5. DASHBOARD & PROJECTS (Firestore) ---

// Load Projects
async function loadProjects() {
    const list = document.getElementById('projects-list');
    const newBtn = document.getElementById('new-project-btn');
    list.innerHTML = ''; // Clear
    list.appendChild(newBtn); // Keep the "New" button

    const q = await getDocs(collection(db, `users/${currentUser.uid}/projects`));
    q.forEach((docSnap) => {
        const data = docSnap.data();
        const card = document.createElement('div');
        card.className = 'project-card';
        card.innerHTML = `
            <h3>${data.name}</h3>
            <p style="font-size:0.8rem; color:#666">Last edited: Today</p>
            <button class="delete-proj" data-id="${docSnap.id}">Delete</button>
        `;
        card.addEventListener('click', (e) => {
            if(!e.target.classList.contains('delete-proj')) openProject(docSnap.id, data);
        });
        
        // Delete Logic
        card.querySelector('.delete-proj').addEventListener('click', async (e) => {
            if(confirm('Delete Project?')) {
                await deleteDoc(doc(db, `users/${currentUser.uid}/projects`, docSnap.id));
                loadProjects();
            }
        });

        list.appendChild(card);
    });
}

// Create New Project
document.getElementById('new-project-btn').addEventListener('click', async () => {
    const name = prompt("Name your composition:", "Untitled Matter");
    if(!name) return;

    const docRef = await addDoc(collection(db, `users/${currentUser.uid}/projects`), {
        name: name,
        createdAt: new Date().toISOString(),
        layers: [] // Empty project
    });
    
    openProject(docRef.id, { name: name });
});

function openProject(id, data) {
    currentProjectId = id;
    document.getElementById('project-title').value = data.name;
    els.dash.classList.add('hidden');
    els.editor.classList.remove('hidden');
    document.getElementById('canvas-stage').innerHTML = ''; // Clear stage
    // TODO: Load layers loop here
}

// Back to Dashboard
document.getElementById('back-to-dash').addEventListener('click', () => {
    els.editor.classList.add('hidden');
    els.dash.classList.remove('hidden');
    loadProjects();
});

// --- 6. EDITOR ENGINE (Effects, Code, Drag) ---

// Tab Switching
document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab, .tab-content').forEach(el => el.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
});

// File Upload
document.getElementById('drop-zone').addEventListener('click', () => document.getElementById('file-upload').click());
document.getElementById('file-upload').addEventListener('change', (e) => {
    Array.from(e.target.files).forEach(file => {
        const url = URL.createObjectURL(file);
        createLayer(url, file.type.includes('video') ? 'video' : 'image');
    });
});

// Create Layer
window.createLayer = function(url, type) {
    const stage = document.getElementById('canvas-stage');
    const el = document.createElement(type === 'video' ? 'video' : 'img');
    el.src = url;
    el.classList.add('layer-element');
    el.style.width = '300px';
    el.style.top = '100px';
    el.style.left = '100px';
    
    if(type === 'video') { el.loop = true; el.muted = true; el.play(); }
    
    // Add interactions
    makeDraggable(el);
    el.addEventListener('mousedown', () => selectLayer(el));
    
    stage.appendChild(el);
};

// Selection & Properties
function selectLayer(el) {
    selectedElement = el;
    document.querySelectorAll('.layer-element').forEach(e => e.classList.remove('selected'));
    el.classList.add('selected');
    
    // Load Properties UI
    const panel = document.getElementById('active-prop-panel');
    const template = document.getElementById('prop-template');
    panel.innerHTML = '';
    panel.appendChild(template.content.cloneNode(true));

    // Bind Inputs
    panel.querySelectorAll('.prop-input').forEach(input => {
        input.addEventListener('input', (e) => {
            const val = e.target.value;
            const prop = e.target.dataset.prop;
            
            if(prop === 'opacity') el.style.opacity = val;
            if(prop === 'blur') el.style.filter = `blur(${val}px) hue-rotate(${panel.querySelector('[data-prop="hue"]').value}deg)`;
            if(prop === 'hue') el.style.filter = `blur(${panel.querySelector('[data-prop="blur"]').value}px) hue-rotate(${val}deg)`;
        });
    });

    // CODE INJECTION (The Magic)
    panel.querySelector('.run-code-btn').addEventListener('click', () => {
        const code = panel.querySelector('.code-editor').value;
        try {
            // Safe(ish) eval context
            const func = new Function('el', code);
            func(el);
            alert('Code Injected Successfully');
        } catch(err) {
            alert('Code Error: ' + err.message);
        }
    });
}

// Draggable Logic
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
        element.style.left = `${initialLeft + (e.clientX - startX)}px`;
        element.style.top = `${initialTop + (e.clientY - startY)}px`;
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
        element.style.cursor = 'grab';
    });
}
