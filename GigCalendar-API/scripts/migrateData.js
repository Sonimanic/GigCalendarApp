import mongoose from 'mongoose';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import Member from '../models/Member.js';
import Gig from '../models/Gig.js';
import Commitment from '../models/Commitment.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gigcalendar';

async function readJsonFile(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error);
    return null;
  }
}

async function migrateData() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Read data files
    const dataDir = path.join(process.cwd(), 'data');
    const { members } = await readJsonFile(path.join(dataDir, 'members.json'));
    const { gigs } = await readJsonFile(path.join(dataDir, 'gigs.json'));
    const { commitments } = await readJsonFile(path.join(dataDir, 'commitments.json'));

    // Clear existing data
    await Promise.all([
      Member.deleteMany({}),
      Gig.deleteMany({}),
      Commitment.deleteMany({})
    ]);

    // Insert new data
    if (members?.length) {
      await Member.insertMany(members);
      console.log(`Migrated ${members.length} members`);
    }

    if (gigs?.length) {
      await Gig.insertMany(gigs);
      console.log(`Migrated ${gigs.length} gigs`);
    }

    if (commitments?.length) {
      await Commitment.insertMany(commitments);
      console.log(`Migrated ${commitments.length} commitments`);
    }

    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
  }
}

migrateData();
