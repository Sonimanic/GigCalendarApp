import mongoose from 'mongoose';

const memberSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'member'], default: 'member' }
}, {
  timestamps: true
});

export default mongoose.model('Member', memberSchema);
