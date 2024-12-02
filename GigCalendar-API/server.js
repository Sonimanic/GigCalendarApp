import express from 'express';
import cors from 'cors';
import { Octokit } from 'octokit';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

const port = process.env.PORT || 3000;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = 'Sonimanic';
const REPO_NAME = 'GigCalendarApp';

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
  try {
    const response = await octokit.rest.repos.getContent({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: `GigCalendar-API/data/${path}`,
    });
    return decodeContent(response.data.content);
  } catch (error) {
    console.error(`Error getting ${path}:`, error);
    return null;
  }
}

// Function to update file content on GitHub
async function updateFileContent(path, content) {
  try {
    // Get the current file to get its SHA
    const currentFile = await octokit.rest.repos.getContent({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: `GigCalendar-API/data/${path}`,
    });

    await octokit.rest.repos.createOrUpdateFileContents({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: `GigCalendar-API/data/${path}`,
      message: `Update ${path}`,
      content: encodeContent(content),
      sha: currentFile.data.sha,
    });

    return true;
  } catch (error) {
    console.error(`Error updating ${path}:`, error);
    return false;
  }
}

// Initialize data cache
async function initializeCache() {
  const [gigs, members, commitments] = await Promise.all([
    getFileContent('gigs.json'),
    getFileContent('members.json'),
    getFileContent('commitments.json'),
  ]);

  if (gigs) dataCache.gigs = gigs.gigs;
  if (members) dataCache.members = members.members;
  if (commitments) dataCache.commitments = commitments.commitments;
}

// Configure CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
}));

app.use(express.json());

// Emit updates to all connected clients
const emitUpdate = (type, data) => {
  io.emit('dataUpdate', { type, data });
};

// API endpoints
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const user = dataCache.members.find(m => m.email === email && m.password === password);
  
  if (user) {
    res.json({ success: true, user });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});

// Gigs endpoints
app.get('/api/gigs', (_, res) => {
  res.json({ gigs: dataCache.gigs });
});

app.post('/api/gigs', async (req, res) => {
  try {
    const newGig = req.body;
    dataCache.gigs.push(newGig);
    await updateFileContent('gigs.json', { gigs: dataCache.gigs });
    emitUpdate('gigs', dataCache.gigs);
    res.json(newGig);
  } catch (error) {
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
      await updateFileContent('gigs.json', { gigs: dataCache.gigs });
      emitUpdate('gigs', dataCache.gigs);
      res.json(dataCache.gigs[index]);
    } else {
      res.status(404).json({ error: 'Gig not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to update gig' });
  }
});

app.delete('/api/gigs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    dataCache.gigs = dataCache.gigs.filter(g => g.id !== id);
    await updateFileContent('gigs.json', { gigs: dataCache.gigs });
    emitUpdate('gigs', dataCache.gigs);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete gig' });
  }
});

// Members endpoints
app.get('/api/members', (_, res) => {
  res.json({ members: dataCache.members });
});

app.post('/api/members', async (req, res) => {
  try {
    const newMember = req.body;
    dataCache.members.push(newMember);
    await updateFileContent('members.json', { members: dataCache.members });
    emitUpdate('members', dataCache.members);
    res.json(newMember);
  } catch (error) {
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
    await updateFileContent('commitments.json', { commitments: dataCache.commitments });
    emitUpdate('commitments', dataCache.commitments);
    res.json(newCommitments);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update commitments' });
  }
});

// Initialize cache when server starts
initializeCache().then(() => {
  console.log('Data cache initialized');
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected');
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

httpServer.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
