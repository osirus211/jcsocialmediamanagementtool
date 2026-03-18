import mongoose, { Schema, Document } from 'mongoose'

export interface ITrustedDevice extends Document {
  userId: mongoose.Types.ObjectId
  deviceId: string
  deviceName: string
  userAgent: string
  ipAddress: string
  trustedAt: Date
  lastSeenAt: Date
  expiresAt: Date
  createdAt: Date
  updatedAt: Date
}

const TrustedDeviceSchema = new Schema<ITrustedDevice>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  deviceId: {
    type: String,
    required: true,
    unique: true
  },
  deviceName: {
    type: String,
    required: true
  },
  userAgent: {
    type: String,
    required: true
  },
  ipAddress: {
    type: String,
    required: true
  },
  trustedAt: {
    type: Date,
    default: Date.now
  },
  lastSeenAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 } // TTL index
  }
}, {
  timestamps: true
})

// Compound indexes
TrustedDeviceSchema.index({ userId: 1, deviceId: 1 }, { unique: true })
TrustedDeviceSchema.index({ userId: 1, expiresAt: 1 })

export const TrustedDevice = mongoose.model<ITrustedDevice>('TrustedDevice', TrustedDeviceSchema)