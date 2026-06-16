import mongoose, { Schema } from 'mongoose';

const CitationSchema = new Schema({
  documentId: {
    type: Schema.Types.ObjectId,
    ref: 'Document',
    required: true,
  },
  documentName: {
    type: String,
    required: true,
  },
  pageNumber: {
    type: Number,
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
});

const MessageSchema = new Schema({
  role: {
    type: String,
    enum: ['user', 'assistant'],
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  citations: [CitationSchema],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const ChatSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  messages: [MessageSchema],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

ChatSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('Chat', ChatSchema);
