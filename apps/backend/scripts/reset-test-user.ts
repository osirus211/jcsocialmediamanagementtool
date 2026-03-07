#!/usr/bin/env ts-node
/**
 * Reset Test User Script
 * Deletes and recreates the test user
 */

import dotenv from 'dotenv';
import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { User } from '../src/models/User';

// Load environment variables
dotenv.config();

async function resetTestUser() {
  try {
    console.log('🔄 Resetting test user...');

    // Connect to database
    await connectDatabase();
    console.log('✅ Database connected');

    const testEmail = 'test@example.com';
    const testPassword = 'Password123'; // Must have uppercase, lowercase, and number

    // Delete existing user
    const deleted = await User.deleteOne({ email: testEmail });
    if (deleted.deletedCount > 0) {
      console.log('🗑️  Deleted existing test user');
    }

    // Create new test user (password will be hashed by pre-save hook)
    const user = new User({
      email: testEmail,
      password: testPassword,
      firstName: 'Test',
      lastName: 'User',
      role: 'member',
      provider: 'local',
    });

    await user.save();

    console.log('✅ Test user created successfully!');
    console.log(`   Email: ${testEmail}`);
    console.log(`   Password: ${testPassword}`);
    console.log(`   User ID: ${user._id}`);

  } catch (error) {
    console.error('❌ Error resetting test user:', error);
    process.exit(1);
  } finally {
    await disconnectDatabase();
    process.exit(0);
  }
}

// Run the function
resetTestUser();
