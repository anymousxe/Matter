// --- 1. SUPABASE CONFIGURATION ---
// We will fill these in after you make the Supabase account
const SUPABASE_URL = 'https://zloyqpcbipxwighqswom.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpsb3lxcGNiaXB4d2lnaHFzd29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2NzEzMDUsImV4cCI6MjA4MDI0NzMwNX0.U8iL4atEScrXhjnI3Qw1vV8i9aIKDrNjh1SxPgbGZic';

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
