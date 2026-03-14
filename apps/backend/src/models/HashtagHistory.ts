import mongoose, { Document, Schema } from 'mongoose';

export interface IHashtagHistory extends Document {
  hashtag: string;
  workspaceId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  platform: string;
  usageCount: number;
  lastUsed: Date;
  createdAt: Date;
  updatedAt: Date;
}

const HashtagHistorySchema = new Schema<IHashtagHistory>({
  hashtag: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    validate: {
      validator: function(hashtag: string) {
        return hashtag.startsWith('#') && hashtag.length > 1 && hashtag.length <= 100;
      },
      message: 'Hashtag must start with # and be between 2-100 characters'
    }
  },
  workspaceId: {
    type: Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  platform: {
    type: String,
    required: true,
    enum: ['instagram', 'twitter', 'tiktok', 'linkedin', 'facebook', 'all'],
    default: 'all'
  },
  usageCount: {
    type: Number,
    default: 1,
    min: 1
  },
  lastUsed: {
    type: Date,
    default: Date.now,
    required: true
  }
}, {
  timestamps: true
});

// Compound indexes for efficient queries
HashtagHistorySchema.index({ workspaceId: 1, hashtag: 1, platform: 1 }, { unique: true });
HashtagHistorySchema.index({ workspaceId: 1, lastUsed: -1 });
HashtagHistorySchema.index({ workspaceId: 1, usageCount: -1 });
HashtagHistorySchema.index({ userId: 1, lastUsed: -1 });

export const HashtagHistory = mongoose.model<IHashtagHistory>('HashtagHistory', HashtagHistorySchema);