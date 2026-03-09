import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * RSSFeedItem Document Interface
 */
export interface IRSSFeedItem extends Document {
  _id: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  feedId: mongoose.Types.ObjectId;
  guid: string;
  title: string;
  link: string;
  description?: string;
  pubDate?: Date;
  author?: string;
  content?: string;
  categories?: string[];
  createdAt: Date;
}

/**
 * RSSFeedItem Schema
 */
const RSSFeedItemSchema = new Schema<IRSSFeedItem>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    feedId: {
      type: Schema.Types.ObjectId,
      ref: 'RSSFeed',
      required: true,
      index: true,
    },
    guid: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    link: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    pubDate: {
      type: Date,
    },
    author: {
      type: String,
      trim: true,
    },
    content: {
      type: String,
    },
    categories: [
      {
        type: String,
        trim: true,
      },
    ],
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

/**
 * Indexes
 */
// Deduplication - prevent duplicate items by guid per feed
RSSFeedItemSchema.index({ feedId: 1, guid: 1 }, { unique: true });

// Query items by feed with pagination
RSSFeedItemSchema.index({ workspaceId: 1, feedId: 1, createdAt: -1 });

// TTL index - automatically delete feed items older than 30 days
RSSFeedItemSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

/**
 * RSSFeedItem Model
 */
export const RSSFeedItem: Model<IRSSFeedItem> = mongoose.model<IRSSFeedItem>('RSSFeedItem', RSSFeedItemSchema);
