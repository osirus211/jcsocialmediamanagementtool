import mongoose, { Schema, Document, Model } from 'mongoose';

export interface DashboardWidget {
  id: string;
  type: string;
  title: string;
  size: 'small' | 'medium' | 'large';
  position: number;
  isVisible: boolean;
  config: Record<string, unknown>;
}

export interface IDashboardLayout extends Document {
  _id: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  widgets: DashboardWidget[];
  createdAt: Date;
  updatedAt: Date;
}

const DashboardWidgetSchema = new Schema<DashboardWidget>({
  id: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  size: {
    type: String,
    enum: ['small', 'medium', 'large'],
    required: true,
  },
  position: {
    type: Number,
    required: true,
  },
  isVisible: {
    type: Boolean,
    required: true,
    default: true,
  },
  config: {
    type: Schema.Types.Mixed,
    default: {},
  },
}, { _id: false });

const DashboardLayoutSchema = new Schema<IDashboardLayout>({
  workspaceId: {
    type: Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true,
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  widgets: [DashboardWidgetSchema],
}, {
  timestamps: true,
});

// Unique compound index: one layout per user per workspace
DashboardLayoutSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });

export const DashboardLayout: Model<IDashboardLayout> = mongoose.model<IDashboardLayout>(
  'DashboardLayout',
  DashboardLayoutSchema
);