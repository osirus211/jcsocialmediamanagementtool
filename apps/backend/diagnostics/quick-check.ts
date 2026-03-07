/**
 * QUICK DIAGNOSTIC CHECK
 * 
 * Minimal script to verify:
 * 1. Logger is writing to files
 * 2. Database connection string
 * 3. User count in database
 */

import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { logger } from '../src/utils/logger';
import fs from 'fs';
import path from 'path';

async function quickCheck() {
  console.log('=== QUICK DIAGNOSTIC CHECK ===\n');
  
  // 1. Check logger configuration
  console.log('1. LOGGER CHECK:');
  console.log('   LOG_LEVEL:', process.env.LOG_LEVEL || 'info');
  console.log('   NODE_ENV:', process.env.NODE_ENV || 'development');
  
  // Test logger
  console.log('   Testing logger.info()...');
  logger.info('QUICK_CHECK_TEST logger.info() called at ' + new Date().toISOString());
  
  console.log('   Testing logger.error()...');
  logger.error('QUICK_CHECK_TEST logger.error() called at ' + new Date().toISOString());
  
  // Check log files
  const logsDir = process.env.NODE_ENV === 'production' ? '/app/logs' : path.join(process.cwd(), 'logs');
  console.log('   Logs directory:', logsDir);
  
  try {
    const files = fs.readdirSync(logsDir);
    console.log('   Log files found:', files.length);
    files.forEach(file => {
      const stats = fs.statSync(path.join(logsDir, file));
      console.log(`     - ${file} (${stats.size} bytes)`);
    });
  } catch (error) {
    console.log('   ⚠️  Could not read logs directory:', error.message);
  }
  
  // 2. Check database connection
  console.log('\n2. DATABASE CHECK:');
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/social-media-scheduler';
  console.log('   MONGODB_URI:', uri.replace(/\/\/.*@/, '//<credentials>@'));
  
  try {
    await mongoose.connect(uri);
    console.log('   ✓ Connected successfully');
    console.log('   Database name:', mongoose.connection.db?.databaseName);
    console.log('   Host:', mongoose.connection.host);
    console.log('   Port:', mongoose.connection.port);
    
    // 3. Check user count
    console.log('\n3. USER COUNT CHECK:');
    const User = mongoose.model('User', new mongoose.Schema({}, { collection: 'users' }));
    
    const totalUsers = await User.countDocuments({});
    const activeUsers = await User.countDocuments({ softDeletedAt: null });
    const deletedUsers = await User.countDocuments({ softDeletedAt: { $ne: null } });
    
    console.log('   Total users:', totalUsers);
    console.log('   Active users (not soft-deleted):', activeUsers);
    console.log('   Soft-deleted users:', deletedUsers);
    
    // List recent users
    if (totalUsers > 0) {
      console.log('\n   Recent users:');
      const recentUsers = await User.find({}).sort({ createdAt: -1 }).limit(5).lean();
      recentUsers.forEach((user: any, index: number) => {
        console.log(`     ${index + 1}. ${user.email} (created: ${user.createdAt || 'unknown'})`);
      });
    }
    
    await mongoose.disconnect();
    console.log('\n✓ Check complete');
    
  } catch (error) {
    console.error('\n✗ Database check failed:', error);
  }
  
  // Wait for logger to flush
  setTimeout(() => {
    console.log('\n✓ Logger should have written to files. Check logs directory.');
    process.exit(0);
  }, 1000);
}

quickCheck();
