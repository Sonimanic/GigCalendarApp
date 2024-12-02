import express from 'express';
import cors from 'cors';
import { Octokit } from 'octokit';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';

dotenv.config();

const app = express();
const httpServer = createServer(app);

const allowedOrigins = ['https://gig-calendar-app.vercel.app', 'http://localhost:5173'];

// Configure CORS for Express
app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Configure Socket.IO with CORS
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "https://gig-calendar-app.vercel.app",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
    credentials: true
  },
  path: '/socket.io',
  transports: ['websocket'],
  allowEIO3: true,
  pingTimeout: 60000
});

app.use(express.json());

// Add a test endpoint
app.get('/', (req, res) => {
  res.json({ message: 'API is working!' });
});

const port = process.env.PORT || 3000;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = 'Sonimanic';
const REPO_NAME = 'GigCalendarApp';

// Check if GitHub token is available
if (!GITHUB_TOKEN) {
  console.error('GITHUB_TOKEN is not set. Please set it in your environment variables.');
  process.exit(1);
}

const octokit = new Octokit({
  auth: GITHUB_TOKEN
});

// Cache for data
let dataCache = {
  gigs: [],
  members: [],
  commitments: []
};

// Function to encode content for GitHub
const encodeContent = (content) => Buffer.from(JSON.stringify(content, null, 2)).toString('base64');

// Function to decode content from GitHub
const decodeContent = (content) => JSON.parse(Buffer.from(content, 'base64').toString());

// Function to get file content from GitHub
async function getFileContent(path) {
  console.log(`Fetching file content for: ${path}`);
  try {
    const response = await octokit.rest.repos.getContent({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: `GigCalendar-API/data/${path}`,
    });
    console.log(`Successfully fetched ${path}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching ${path}:`, error.message);
    throw error;
  }
}

// Function to update file content on GitHub
async function updateFileContent(path, content) {
  try {
    let sha;
    try {
      const currentFile = await octokit.rest.repos.getContent({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        path: `GigCalendar-API/data/${path}`,
      });
      sha = currentFile.data.sha;
    } catch (error) {
      if (error.status !== 404) throw error;
      // File doesn't exist yet, that's okay
    }

    const fileContent = {
      [path.replace('.json', '')]: content
    };

    await octokit.rest.repos.createOrUpdateFileContents({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: `GigCalendar-API/data/${path}`,
      message: `Update ${path}`,
      content: encodeContent(fileContent),
      sha,
    });
  } catch (error) {
    console.error(`Error updating file ${path}:`, error.message);
    throw error;
  }
}

// Function to initialize data cache
async function initializeCache() {
  console.log('Initializing data cache...');
  try {
    console.log('GitHub Token available:', !!GITHUB_TOKEN);
    
    const [gigsFile, membersFile, commitmentsFile] = await Promise.all([
      getFileContent('gigs.json'),
      getFileContent('members.json'),
      getFileContent('commitments.json'),
    ]);

    dataCache.gigs = JSON.parse(decodeContent(gigsFile.content));
    dataCache.members = JSON.parse(decodeContent(membersFile.content));
    dataCache.commitments = JSON.parse(decodeContent(commitmentsFile.content));
    
    console.log(`Cache initialized with ${dataCache.gigs.length} gigs, ${dataCache.members.length} members, and ${dataCache.commitments.length} commitments`);
  } catch (error) {
    console.error('Failed to initialize cache:', error);
    dataCache = { gigs: [], members: [], commitments: [] };
  }
}

// Emit updates to all connected clients
const emitUpdate = (type, data) => {
  io.emit('dataUpdate', { type, data });
};

// Gigs endpoints
app.get('/api/gigs', (_, res) => {
  console.log('GET /api/gigs - Returning gigs:', dataCache.gigs.length);
  res.json({ gigs: dataCache.gigs });
});

app.post('/api/gigs', async (req, res) => {
  try {
    const newGig = req.body;
    dataCache.gigs.push(newGig);
    await updateFileContent('gigs.json', dataCache.gigs);
    emitUpdate('gigs', dataCache.gigs);
    res.json(newGig);
  } catch (error) {
    console.error('Failed to add gig:', error);
    res.status(500).json({ error: 'Failed to add gig' });
  }
});

app.put('/api/gigs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const index = dataCache.gigs.findIndex(g => g.id === id);
    
    if (index !== -1) {
      dataCache.gigs[index] = { ...dataCache.gigs[index], ...updates };
      await updateFileContent('gigs.json', dataCache.gigs);
      emitUpdate('gigs', dataCache.gigs);
      res.json(dataCache.gigs[index]);
    } else {
      res.status(404).json({ error: 'Gig not found' });
    }
  } catch (error) {
    console.error('Failed to update gig:', error);
    res.status(500).json({ error: 'Failed to update gig' });
  }
});

app.delete('/api/gigs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    dataCache.gigs = dataCache.gigs.filter(g => g.id !== id);
    await updateFileContent('gigs.json', dataCache.gigs);
    emitUpdate('gigs', dataCache.gigs);
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete gig:', error);
    res.status(500).json({ error: 'Failed to delete gig' });
  }
});

// Authentication endpoint
app.post('/api/login', async (req, res) => {
  console.log('Login attempt for:', req.body.email);
  try {
    const { email, password } = req.body;
    const members = dataCache.members;
    
    console.log('Looking up user in members list...');
    const user = members.find(
      (member) => member.email === email && member.password === password
    );

    if (user) {
      console.log('User found:', user.email);
      const { password: _, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
    } else {
      console.log('User not found or invalid credentials');
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Members endpoints
app.get('/api/members', async (req, res) => {
  console.log('GET /api/members');
  try {
    const members = dataCache.members.map(({ password: _, ...member }) => member);
    console.log(`Returning ${members.length} members`);
    res.json(members);
  } catch (error) {
    console.error('Error fetching members:', error);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

app.post('/api/members', async (req, res) => {
  try {
    const newMember = req.body;
    dataCache.members.push(newMember);
    await updateFileContent('members.json', dataCache.members);
    emitUpdate('members', dataCache.members);
    res.json(newMember);
  } catch (error) {
    console.error('Failed to add member:', error);
    res.status(500).json({ error: 'Failed to add member' });
  }
});

// Commitments endpoints
app.get('/api/commitments', (_, res) => {
  res.json({ commitments: dataCache.commitments });
});

app.post('/api/commitments', async (req, res) => {
  try {
    const newCommitments = req.body;
    dataCache.commitments = newCommitments;
    await updateFileContent('commitments.json', dataCache.commitments);
    emitUpdate('commitments', dataCache.commitments);
    res.json(newCommitments);
  } catch (error) {
    console.error('Failed to update commitments:', error);
    res.status(500).json({ error: 'Failed to update commitments' });
  }
});

// Initialize cache when server starts
initializeCache().then(() => {
  console.log('Data cache initialized');
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });

  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});

httpServer.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
