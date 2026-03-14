import mongoose, { Document, Schema } from 'mongoose';

export interface IHashtagGroup extends Document {
  name: string;
  hashtags: string[];
  platform: 'instagram' | 'twitter' | 'tiktok' | 'linkedin' | 'facebook' | 'all';
  workspaceId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const HashtagGroupSchema = new Schema<IHashtagGroup>({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  hashtags: [{
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: function(hashtag: string) {
        return hashtag.startsWith('#') && hashtag.length > 1 && hashtag.length <= 100;
      },
      message: 'Hashtag must start with # and be between 2-100 characters'
    }
  }],
  platform: {
    type: String,
    enum: ['instagram', 'twitter', 'tiktok', 'linkedin', 'facebook', 'all'],
    default: 'all',
    required: true
  },
  workspaceId: {
    type: Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Compound index for efficient queries
HashtagGroupSchema.index({ workspaceId: 1, platform: 1 });
HashtagGroupSchema.index({ workspaceId: 1, name: 1 }, { unique: true });

export const HashtagGroup = mongoose.model<IHashtagGroup>('HashtagGroup', HashtagGroupSchema);