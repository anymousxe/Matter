// --- 1. SUPABASE CONFIGURATION ---
// We will fill these in after you make the Supabase account
const SUPABASE_URL = 'PASTE_URL_HERE';
const SUPABASE_KEY = 'PASTE_KEY_HERE';

// Initialize Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

console.log("GemEdit Engine: Started 🚀");

// --- 2. UPLOAD LOGIC ---
const uploadInput = document.getElementById('upload-input');
const canvas = document.getElementById('canvas-container');

uploadInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    console.log("Uploading:", file.name);

    // Create a unique file path
    const filePath = `uploads/${Date.now()}_${file.name}`;

    // Upload to 'user-uploads' bucket
    const { data, error } = await supabase.storage
        .from('user-uploads')
        .upload(filePath, file);

    if (error) {
        console.error("Upload Error:", error);
        alert("Upload failed! Did you set up the Storage bucket?");
    } else {
        console.log("Upload done:", data);
        
        // Get the public link
        const { data: { publicUrl } } = supabase.storage
            .from('user-uploads')
            .getPublicUrl(filePath);

        // Add to Canvas
        addToCanvas(publicUrl);
    }
});

function addToCanvas(url) {
    // Remove placeholder text
    const placeholder = document.querySelector('.placeholder');
    if (placeholder) placeholder.remove();

    // Create Image Layer
    const img = document.createElement('img');
    img.src = url;
    img.classList.add('layer-asset');
    img.style.width = '300px';
    img.style.top = '50%';
    img.style.left = '50%';
    img.style.transform = 'translate(-50%, -50%)'; // Centers it

    canvas.appendChild(img);
    console.log("Layer added to stage.");
}
