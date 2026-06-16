import mongoose, { Schema } from 'mongoose';

const FlashcardSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  documentId: {
    type: Schema.Types.ObjectId,
    ref: 'Document',
    index: true,
  },
  front: {
    type: String,
    required: true,
    trim: true,
  },
  back: {
    type: String,
    required: true,
    trim: true,
  },
  status: {
    type: String,
    enum: ['review', 'learned'],
    default: 'review',
    index: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model('Flashcard', FlashcardSchema);
