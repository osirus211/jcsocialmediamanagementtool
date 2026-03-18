import mongoose, { Schema, Document } from 'mongoose'

export interface ILoginHistory extends Document {
  userId: mongoose.Types.ObjectId
  ipAddress: string
  userAgent: string
  country?: string
  success: boolean
  failureReason?: string
  riskScore: number
  mfaRequired: boolean
  mfaCompleted: boolean
  createdAt: Date
}

const LoginHistorySchema = new Schema<ILoginHistory>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  ipAddress: {
    type: String,
    required: true,
    index: true
  },
  userAgent: {
    type: String,
    required: true
  },
  country: {
    type: String
  },
  success: {
    type: Boolean,
    required: true,
    index: true
  },
  failureReason: {
    type: String
  },
  riskScore: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  mfaRequired: {
    type: Boolean,
    default: false
  },
  mfaCompleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
})

// Indexes
LoginHistorySchema.index({ userId: 1, createdAt: -1 })
LoginHistorySchema.index({ userId: 1, success: 1, createdAt: -1 })
LoginHistorySchema.index({ userId: 1, ipAddress: 1, success: 1 })
LoginHistorySchema.index({ userId: 1, userAgent: 1, success: 1 })

// TTL index - automatically delete records after 90 days
LoginHistorySchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 })

export const LoginHistory = mongoose.model<ILoginHistory>('LoginHistory', LoginHistorySchema)