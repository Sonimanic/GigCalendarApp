import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';

// Import models
import Member from './models/Member.js';
import Gig from './models/Gig.js';
import Commitment from './models/Commitment.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);

// Function to validate origin
const isValidOrigin = (origin) => {
  if (!origin) return false;
  return origin.endsWith('.vercel.app') || 
         origin === 'http://localhost:5173' ||
         origin === 'https://gig-calendar-app.vercel.app';
};

// Configure CORS for Express
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || isValidOrigin(origin)) {
      callback(null, true);
    } else {
      console.log('Blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Configure Socket.IO with CORS
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || isValidOrigin(origin)) {
        callback(null, true);
      } else {
        console.log('Blocked WebSocket origin:', origin);
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
    credentials: true
  },
  path: '/socket.io',
  transports: ['polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
  upgradeTimeout: 10000,
  maxHttpBufferSize: 1e8
});

app.use(express.json());

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gigcalendar';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Emit updates to all connected clients
const emitUpdate = (type, data) => {
  io.emit('dataUpdate', { type, data });
};

// Authentication endpoint
app.post('/api/login', async (req, res) => {
  console.log('Login attempt for:', req.body.email);
  try {
    const { email, password } = req.body;
    const user = await Member.findOne({ email, password });

    if (user) {
      console.log('User found:', user.email);
      const { password: _, ...userWithoutPassword } = user.toObject();
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
  try {
    const members = await Member.find({}, { password: 0 });
    res.json(members);
  } catch (error) {
    console.error('Error fetching members:', error);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

app.post('/api/members', async (req, res) => {
  try {
    const member = new Member(req.body);
    await member.save();
    const { password: _, ...memberWithoutPassword } = member.toObject();
    emitUpdate('members', await Member.find({}, { password: 0 }));
    res.json(memberWithoutPassword);
  } catch (error) {
    console.error('Failed to add member:', error);
    res.status(500).json({ error: 'Failed to add member' });
  }
});

// Gigs endpoints
app.get('/api/gigs', async (req, res) => {
  try {
    const gigs = await Gig.find();
    res.json({ gigs });
  } catch (error) {
    console.error('Error fetching gigs:', error);
    res.status(500).json({ error: 'Failed to fetch gigs' });
  }
});

app.post('/api/gigs', async (req, res) => {
  try {
    const gig = new Gig(req.body);
    await gig.save();
    emitUpdate('gigs', await Gig.find());
    res.json(gig);
  } catch (error) {
    console.error('Failed to add gig:', error);
    res.status(500).json({ error: 'Failed to add gig' });
  }
});

app.put('/api/gigs/:id', async (req, res) => {
  try {
    const gig = await Gig.findOneAndUpdate(
      { id: req.params.id },
      req.body,
      { new: true }
    );
    if (!gig) {
      return res.status(404).json({ error: 'Gig not found' });
    }
    emitUpdate('gigs', await Gig.find());
    res.json(gig);
  } catch (error) {
    console.error('Failed to update gig:', error);
    res.status(500).json({ error: 'Failed to update gig' });
  }
});

app.delete('/api/gigs/:id', async (req, res) => {
  try {
    const gig = await Gig.findOneAndDelete({ id: req.params.id });
    if (!gig) {
      return res.status(404).json({ error: 'Gig not found' });
    }
    emitUpdate('gigs', await Gig.find());
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete gig:', error);
    res.status(500).json({ error: 'Failed to delete gig' });
  }
});

// Commitments endpoints
app.get('/api/commitments', async (req, res) => {
  try {
    const commitments = await Commitment.find();
    res.json({ commitments });
  } catch (error) {
    console.error('Error fetching commitments:', error);
    res.status(500).json({ error: 'Failed to fetch commitments' });
  }
});

app.post('/api/commitments', async (req, res) => {
  try {
    const commitment = new Commitment(req.body);
    await commitment.save();
    emitUpdate('commitments', await Commitment.find());
    res.json(commitment);
  } catch (error) {
    console.error('Failed to update commitments:', error);
    res.status(500).json({ error: 'Failed to update commitments' });
  }
});

// Add middleware to log all Socket.IO events
io.use((socket, next) => {
  console.log('Socket middleware - connection attempt from:', socket.handshake.address);
  console.log('Socket middleware - headers:', socket.handshake.headers);
  next();
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

const port = process.env.PORT || 3000;
httpServer.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
