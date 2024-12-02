import express from 'express';
import cors from 'cors';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

const port = process.env.PORT || 3000;

// Configure CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
}));

app.use(express.json());

const DATA_DIR = join(__dirname, 'data');
const GIGS_FILE = join(DATA_DIR, 'gigs.json');
const COMMITMENTS_FILE = join(DATA_DIR, 'commitments.json');
const MEMBERS_FILE = join(DATA_DIR, 'members.json');

// Ensure data directory exists
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize files if they don't exist
const initializeFile = (filePath, defaultContent) => {
  if (!existsSync(filePath)) {
    writeFileSync(filePath, JSON.stringify(defaultContent));
  }
};

initializeFile(GIGS_FILE, { gigs: [] });
initializeFile(COMMITMENTS_FILE, { commitments: [] });
initializeFile(MEMBERS_FILE, {
  members: [
    {
      id: "1",
      name: "Brian VanPortfleet",
      email: "bvanportfleet@gmail.com",
      phone: "555-0101",
      password: "admin123",
      role: "admin"
    }
  ]
});

// Read data files
const readGigs = () => {
  try {
    return JSON.parse(readFileSync(GIGS_FILE, 'utf8'));
  } catch (error) {
    console.error('Error reading gigs:', error);
    return { gigs: [] };
  }
};

const readMembers = () => {
  try {
    return JSON.parse(readFileSync(MEMBERS_FILE, 'utf8'));
  } catch (error) {
    console.error('Error reading members:', error);
    return { members: [] };
  }
};

const readCommitments = () => {
  try {
    return JSON.parse(readFileSync(COMMITMENTS_FILE, 'utf8'));
  } catch (error) {
    console.error('Error reading commitments:', error);
    return { commitments: [] };
  }
};

// Write data files
const writeGigs = (data) => {
  try {
    writeFileSync(GIGS_FILE, JSON.stringify(data, null, 2));
    emitUpdate('gigs', data.gigs);
  } catch (error) {
    console.error('Error writing gigs:', error);
  }
};

const writeMembers = (data) => {
  try {
    writeFileSync(MEMBERS_FILE, JSON.stringify(data, null, 2));
    emitUpdate('members', data.members);
  } catch (error) {
    console.error('Error writing members:', error);
  }
};

const writeCommitments = (data) => {
  try {
    writeFileSync(COMMITMENTS_FILE, JSON.stringify(data, null, 2));
    emitUpdate('commitments', data.commitments);
  } catch (error) {
    console.error('Error writing commitments:', error);
  }
};

// Emit updates to all connected clients
const emitUpdate = (type, data) => {
  io.emit('dataUpdate', { type, data });
};

// API endpoints
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const { members } = readMembers();
  
  const user = members.find(m => m.email === email && m.password === password);
  
  if (user) {
    res.json({ success: true, user });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});

app.get('/api/members', (_, res) => {
  try {
    const data = readMembers();
    res.json(data.members);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

app.post('/api/members', (req, res) => {
  try {
    const newMember = req.body;
    const data = readMembers();
    data.members.push(newMember);
    writeMembers(data);
    res.json(newMember);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add member' });
  }
});

app.put('/api/members/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const data = readMembers();
    const index = data.members.findIndex(m => m.id === id);
    
    if (index !== -1) {
      data.members[index] = { ...data.members[index], ...updates };
      writeMembers(data);
      res.json(data.members[index]);
    } else {
      res.status(404).json({ error: 'Member not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to update member' });
  }
});

app.delete('/api/members/:id', (req, res) => {
  try {
    const { id } = req.params;
    const data = readMembers();
    data.members = data.members.filter(m => m.id !== id);
    writeMembers(data);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete member' });
  }
});

app.get('/api/gigs', (_, res) => {
  try {
    const data = readGigs();
    res.json(data.gigs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch gigs' });
  }
});

app.post('/api/gigs', (req, res) => {
  try {
    const newGig = req.body;
    const data = readGigs();
    data.gigs.push(newGig);
    writeGigs(data);
    res.json(newGig);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add gig' });
  }
});

app.put('/api/gigs/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const data = readGigs();
    const index = data.gigs.findIndex(g => g.id === id);
    
    if (index !== -1) {
      data.gigs[index] = { ...data.gigs[index], ...updates };
      writeGigs(data);
      res.json(data.gigs[index]);
    } else {
      res.status(404).json({ error: 'Gig not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to update gig' });
  }
});

app.delete('/api/gigs/:id', (req, res) => {
  try {
    const { id } = req.params;
    const data = readGigs();
    data.gigs = data.gigs.filter(g => g.id !== id);
    writeGigs(data);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete gig' });
  }
});

app.get('/api/commitments', (_, res) => {
  try {
    const data = readCommitments();
    res.json(data.commitments);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch commitments' });
  }
});

app.post('/api/commitments', (req, res) => {
  try {
    const newCommitments = req.body;
    const data = { commitments: newCommitments };
    writeCommitments(data);
    res.json(newCommitments);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update commitments' });
  }
});

// Health check endpoint
app.get('/health', (_, res) => {
  res.json({ status: 'healthy' });
});

// Handle all other routes for SPA
app.get('*', (_, res) => {
  res.json({ message: 'API endpoint not found' });
});

httpServer.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
