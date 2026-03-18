import mongoose, { Schema, Document } from 'mongoose'

export interface ISAMLConfig extends Document {
  workspaceId: mongoose.Types.ObjectId
  entryPoint: string
  issuer: string
  cert: string
  emailDomain: string
  isEnabled: boolean
  autoProvision: boolean
  defaultRole: string
  createdAt: Date
  updatedAt: Date
}

const SAMLConfigSchema = new Schema<ISAMLConfig>({
  workspaceId: {
    type: Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    unique: true
  },
  entryPoint: {
    type: String,
    required: true
  },
  issuer: {
    type: String,
    required: true
  },
  cert: {
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
SAMLConfigSchema.index({ workspaceId: 1 }, { unique: true })
SAMLConfigSchema.index({ emailDomain: 1 }, { unique: true, sparse: true })

export const SAMLConfig = mongoose.model<ISAMLConfig>('SAMLConfig', SAMLConfigSchema)