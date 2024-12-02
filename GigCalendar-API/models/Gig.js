import mongoose from 'mongoose';

const gigSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  date: { type: Date, required: true },
  venue: { type: String, required: true },
  address: { type: String },
  description: { type: String },
  payment: { type: String },
  requirements: { type: String },
  status: { type: String, enum: ['pending', 'confirmed', 'cancelled'], default: 'pending' },
  assignedMembers: [{ type: String, ref: 'Member' }]
}, {
  timestamps: true
});

export default mongoose.model('Gig', gigSchema);
