/**
 * Base Model
 * 
 * Base interface for all models
 */

import mongoose from 'mongoose';

export interface BaseModel {
  _id: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  version?: number;
}

// Mock implementation for testing
export const BaseModel = {
  find: jest.fn(),
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  create: jest.fn(),
  updateOne: jest.fn(),
  deleteOne: jest.fn(),
};