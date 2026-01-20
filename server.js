const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = './data.json';

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 1. INITIALIZE DATA & FOLDERS
if (!fs.existsSync('./uploads')) fs.mkdirSync('./uploads');

let db = { users: [], clips: [] };

// Load existing data from JSON file if it exists
if (fs.existsSync(DATA_FILE)) {
  const fileData = fs.readFileSync(DATA_FILE, 'utf8');
  db = JSON.parse(fileData);
  console.log("✅ Permanent data loaded from JSON");
} else {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db));
  console.log("🆕 Created new data.json file");
}

// Function to save current state to JSON
function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

// Storage configuration for videos
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// --- AUTHENTICATION ROUTES ---

app.post('/signup', (req, res) => {
  const { username, password } = req.body;
  if (db.users.find(u => u.username === username)) {
    return res.status(400).json({ error: "User already exists" });
  }
  db.users.push({ username, password });
  saveData(); // <--- Permanent Save
  res.json({ message: "Signup successful" });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.users.find(u => u.username === username && u.password === password);
  if (!user) {
    return res.status(401).json({ error: "Invalid username or password" });
  }
  res.json({ message: "Login successful" });
});

// --- CLIP ROUTES ---

app.get('/clips', (req, res) => {
  res.json(db.clips);
});

app.post('/clips', upload.single('clip'), (req, res) => {
  const newClip = {
    id: Date.now().toString(),
    title: req.body.title,
    category: req.body.category,
    tags: req.body.tags,
    uploader: req.body.uploader,
    videoURL: `http://localhost:${PORT}/uploads/${req.file.filename}`,
    views: 0, // Initialize views
    likes: 0,  // Initialize likes
  };
  db.clips.push(newClip);
  saveData();
  res.json(newClip);
});

// Route to increment views or likes
app.post('/clips/:id/interact', (req, res) => {
  const { id } = req.params;
  const { type } = req.body; // 'view' or 'like'
  const clip = db.clips.find(c => c.id === id);
  
  if (clip) {
    if (type === 'view') {
      clip.views = (clip.views || 0) + 1;
    } else if (type === 'like') {
      clip.likes = (clip.likes || 0) + 1;
    }
    saveData(); // Save to data.json permanently
    return res.json(clip);
  }
  res.status(404).json({ error: "Clip not found" });
});

app.delete('/clips/:id', (req, res) => {
  db.clips = db.clips.filter(c => c.id !== req.params.id);
  saveData(); // <--- Permanent Save
  res.json({ message: "Clip deleted" });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

app.post('/clips/:id/interact', (req, res) => {
  const { id } = req.params;
  const { type, username } = req.body; // Receive username from the request
  const clip = db.clips.find(c => c.id === id);
  
  if (clip) {
    if (type === 'view') {
      clip.views = (clip.views || 0) + 1;
    } else if (type === 'like') {
      // 1. Check if user is logged in
      if (!username) {
        return res.status(401).json({ error: "Must be logged in to like" });
      }

      // 2. Initialize likes as an array if it's currently a number or undefined
      if (!Array.isArray(clip.likes)) {
        clip.likes = []; 
      }

      // 3. Logic: If user already liked, remove it (unlike). If not, add it.
      if (clip.likes.includes(username)) {
        clip.likes = clip.likes.filter(user => user !== username);
      } else {
        clip.likes.push(username);
      }
    }
    
    saveData();
    // Return the count of likes (length of the array)
    res.json({ 
      success: true, 
      views: clip.views, 
      likes: Array.isArray(clip.likes) ? clip.likes.length : 0 
    });
  } else {
    res.status(404).json({ error: "Clip not found" });
  }

});
