import mongoose, { Schema, Document } from 'mongoose'

export interface IOIDCConfig extends Document {
  workspaceId: mongoose.Types.ObjectId
  issuerUrl: string
  clientId: string
  clientSecret: string
  redirectUri: string
  emailDomain: string
  isEnabled: boolean
  autoProvision: boolean
  defaultRole: string
  createdAt: Date
  updatedAt: Date
}

const OIDCConfigSchema = new Schema<IOIDCConfig>({
  workspaceId: {
    type: Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    unique: true
  },
  issuerUrl: {
    type: String,
    required: true
  },
  clientId: {
    type: String,
    required: true
  },
  clientSecret: {
    type: String,
    required: true
  },
  redirectUri: {
    type: String,
    required: true
  },
  emailDomain: {
    type: String,
    required: true
  },
  isEnabled: {
    type: Boolean,
    default: false
  },
  autoProvision: {
    type: Boolean,
    default: true
  },
  defaultRole: {
    type: String,
    default: 'MEMBER'
  }
}, {
  timestamps: true
})

// Indexes
OIDCConfigSchema.index({ workspaceId: 1 }, { unique: true })
OIDCConfigSchema.index({ emailDomain: 1 }, { unique: true, sparse: true })

export const OIDCConfig = mongoose.model<IOIDCConfig>('OIDCConfig', OIDCConfigSchema)