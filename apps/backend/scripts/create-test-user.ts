#!/usr/bin/env ts-node
/**
 * Create Test User Script
 * Creates a test user for development
 */

import dotenv from 'dotenv';
import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { User } from '../src/models/User';
import bcrypt from 'bcrypt';

// Load environment variables
dotenv.config();

async function createTestUser() {
  try {
    console.log('🌱 Creating test user...');

    // Connect to database
    await connectDatabase();
    console.log('✅ Database connected');

    const testEmail = 'test@example.com';
    const testPassword = 'password123';

    // Check if user already exists
    const existingUser = await User.findOne({ email: testEmail });
    
    if (existingUser) {
      console.log('✅ Test user already exists');
      console.log(`   Email: ${testEmail}`);
      console.log(`   Password: ${testPassword}`);
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(testPassword, 10);

    // Create test user
    const user = new User({
      email: testEmail,
      password: hashedPassword,
      firstName: 'Test',
      lastName: 'User',
      plan: 'free',
    });

    await user.save();

    console.log('✅ Test user created successfully!');
    console.log(`   Email: ${testEmail}`);
    console.log(`   Password: ${testPassword}`);
    console.log(`   User ID: ${user._id}`);

  } catch (error) {
    console.error('❌ Error creating test user:', error);
    process.exit(1);
  } finally {
    await disconnectDatabase();
    process.exit(0);
  }
}

// Run the function
createTestUser();
