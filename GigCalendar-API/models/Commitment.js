import mongoose from 'mongoose';

const commitmentSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  memberId: { type: String, ref: 'Member', required: true },
  gigId: { type: String, ref: 'Gig', required: true },
  status: { type: String, enum: ['pending', 'confirmed', 'declined'], default: 'pending' }
}, {
  timestamps: true
});

export default mongoose.model('Commitment', commitmentSchema);
