import mongoose, { Schema } from 'mongoose';

const ChunkSchema = new Schema({
  documentId: {
    type: Schema.Types.ObjectId,
    ref: 'Document',
    required: true,
    index: true,
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  content: {
    type: String,
    required: true,
  },
  pageNumber: {
    type: Number,
    required: true,
  },
  embedding: {
    type: [Number],
    required: true,
  },
});



export default mongoose.model('Chunk', ChunkSchema);
