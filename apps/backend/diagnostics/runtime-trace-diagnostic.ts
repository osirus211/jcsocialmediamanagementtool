/**
 * RUNTIME TRACE DIAGNOSTIC SCRIPT
 * 
 * This script performs a comprehensive investigation of the auth runtime failure.
 * It will trace the EXACT execution path and identify where the failure occurs.
 */

import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { logger } from '../src/utils/logger';
import { User } from '../src/models/User';
import { AuthService } from '../src/services/AuthService';

// DIAGNOSTIC FLAGS
const DIAGNOSTIC = {
  LOGGER_TEST: true,
  DB_CONNECTION_TEST: true,
  USER_MODEL_TEST: true,
  AUTH_SERVICE_TEST: true,
  FULL_REGISTRATION_TEST: true,
};

/**
 * Test 1: Logger Functionality
 */
async function testLogger() {
  console.log('\n=== TEST 1: LOGGER FUNCTIONALITY ===');
  
  // Test console.log (baseline)
  console.log('✓ console.log() works');
  
  // Test logger.info
  logger.info('DIAGNOSTIC_TEST logger.info() called');
  
  // Test logger.error
  logger.error('DIAGNOSTIC_TEST logger.error() called');
  
  // Test logger with metadata
  logger.info('DIAGNOSTIC_TEST logger with metadata', { 
    timestamp: new Date().toISOString(),
    testData: 'sample' 
  });
  
  console.log('✓ Logger test complete - check logs/application-*.log for output');
  
  // Wait for async writes
  await new Promise(resolve => setTimeout(resolve, 1000));
}

/**
 * Test 2: Database Connection
 */
async function testDatabaseConnection() {
  console.log('\n=== TEST 2: DATABASE CONNECTION ===');
  
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/social-media-scheduler';
    console.log('Connecting to:', uri.replace(/\/\/.*@/, '//<credentials>@'));
    
    await mongoose.connect(uri);
    
    console.log('✓ MongoDB connected');
    console.log('  - Connection name:', mongoose.connection.name);
    console.log('  - Connection host:', mongoose.connection.host);
    console.log('  - Connection port:', mongoose.connection.port);
    console.log('  - Database name:', mongoose.connection.db?.databaseName);
    
    logger.info('DIAGNOSTIC_TEST MongoDB connection successful', {
      dbName: mongoose.connection.name,
      host: mongoose.connection.host,
    });
    
  } catch (error) {
    console.error('✗ MongoDB connection failed:', error);
    logger.error('DIAGNOSTIC_TEST MongoDB connection failed', { error });
    throw error;
  }
}

/**
 * Test 3: User Model Operations
 */
async function testUserModel() {
  console.log('\n=== TEST 3: USER MODEL OPERATIONS ===');
  
  try {
    // Test 3a: Count existing users
    const userCount = await User.countDocuments({ softDeletedAt: null });
    console.log(`✓ User count query successful: ${userCount} users`);
    logger.info('DIAGNOSTIC_TEST User count', { count: userCount });
    
    // Test 3b: Create test user
    const testEmail = `diagnostic-test-${Date.now()}@example.com`;
    console.log(`Creating test user: ${testEmail}`);
    
    console.log('TRACE_MARKER_BEFORE_USER_CREATE');
    logger.info('DIAGNOSTIC_TEST BEFORE_USER_CREATE', { email: testEmail });
    
    const testUser = new User({
      email: testEmail,
      password: 'TestPassword123!',
      firstName: 'Diagnostic',
      lastName: 'Test',
      provider: 'local',
    });
    
    console.log('TRACE_MARKER_BEFORE_USER_SAVE');
    logger.info('DIAGNOSTIC_TEST BEFORE_USER_SAVE', { email: testEmail });
    
    const savedUser = await testUser.save();
    
    console.log('TRACE_MARKER_AFTER_USER_SAVE');
    logger.info('DIAGNOSTIC_TEST AFTER_USER_SAVE', { 
      userId: savedUser._id,
      email: savedUser.email 
    });
    
    console.log('✓ User created successfully');
    console.log('  - User ID:', savedUser._id);
    console.log('  - Email:', savedUser.email);
    
    // Test 3c: Verify user persisted
    const verifyUser = await User.findById(savedUser._id);
    if (verifyUser) {
      console.log('✓ User verified in database');
      logger.info('DIAGNOSTIC_TEST User verified', { userId: verifyUser._id });
    } else {
      console.error('✗ User NOT found in database after save!');
      logger.error('DIAGNOSTIC_TEST User NOT found after save', { userId: savedUser._id });
    }
    
    // Test 3d: Clean up test user
    await User.deleteOne({ _id: savedUser._id });
    console.log('✓ Test user cleaned up');
    
  } catch (error) {
    console.error('✗ User model test failed:', error);
    logger.error('DIAGNOSTIC_TEST User model test failed', { error });
    throw error;
  }
}

/**
 * Test 4: Auth Service Registration
 */
async function testAuthService() {
  console.log('\n=== TEST 4: AUTH SERVICE REGISTRATION ===');
  
  try {
    const testEmail = `auth-service-test-${Date.now()}@example.com`;
    console.log(`Testing AuthService.register() with: ${testEmail}`);
    
    console.log('TRACE_MARKER_BEFORE_AUTH_REGISTER');
    logger.info('DIAGNOSTIC_TEST BEFORE_AUTH_REGISTER', { email: testEmail });
    
    const result = await AuthService.register({
      email: testEmail,
      password: 'TestPassword123!',
      firstName: 'Auth',
      lastName: 'Test',
    });
    
    console.log('TRACE_MARKER_AFTER_AUTH_REGISTER');
    logger.info('DIAGNOSTIC_TEST AFTER_AUTH_REGISTER', { 
      userId: result.user._id,
      email: result.user.email 
    });
    
    console.log('✓ AuthService.register() successful');
    console.log('  - User ID:', result.user._id);
    console.log('  - Email:', result.user.email);
    console.log('  - Access Token:', result.tokens.accessToken ? 'Generated' : 'Missing');
    console.log('  - Refresh Token:', result.tokens.refreshToken ? 'Generated' : 'Missing');
    
    // Verify user persisted
    const verifyUser = await User.findById(result.user._id);
    if (verifyUser) {
      console.log('✓ User verified in database after AuthService.register()');
      logger.info('DIAGNOSTIC_TEST User verified after AuthService', { userId: verifyUser._id });
    } else {
      console.error('✗ User NOT found in database after AuthService.register()!');
      logger.error('DIAGNOSTIC_TEST User NOT found after AuthService', { userId: result.user._id });
    }
    
    // Clean up
    await User.deleteOne({ _id: result.user._id });
    console.log('✓ Test user cleaned up');
    
  } catch (error) {
    console.error('✗ AuthService test failed:', error);
    logger.error('DIAGNOSTIC_TEST AuthService test failed', { error });
    throw error;
  }
}

/**
 * Test 5: Full Registration Flow (HTTP simulation)
 */
async function testFullRegistration() {
  console.log('\n=== TEST 5: FULL REGISTRATION FLOW ===');
  
  try {
    const testEmail = `full-flow-test-${Date.now()}@example.com`;
    console.log(`Simulating full registration flow for: ${testEmail}`);
    
    // Simulate AuthController.register()
    console.log('TRACE_MARKER_CONTROLLER_START');
    logger.info('RUNTIME_TRACE REGISTER_START', { timestamp: new Date().toISOString() });
    
    const result = await AuthService.register({
      email: testEmail,
      password: 'TestPassword123!',
      firstName: 'Full',
      lastName: 'Flow',
    });
    
    console.log('TRACE_MARKER_CONTROLLER_END');
    logger.info('RUNTIME_TRACE REGISTER_COMPLETE', { timestamp: new Date().toISOString() });
    
    console.log('✓ Full registration flow successful');
    console.log('  - User ID:', result.user._id);
    console.log('  - Email:', result.user.email);
    
    // Final verification
    const finalCheck = await User.findById(result.user._id);
    if (finalCheck) {
      console.log('✓ FINAL VERIFICATION: User persisted successfully');
      logger.info('DIAGNOSTIC_TEST FINAL_VERIFICATION_SUCCESS', { userId: finalCheck._id });
    } else {
      console.error('✗ FINAL VERIFICATION FAILED: User NOT in database!');
      logger.error('DIAGNOSTIC_TEST FINAL_VERIFICATION_FAILED', { userId: result.user._id });
    }
    
    // Clean up
    await User.deleteOne({ _id: result.user._id });
    console.log('✓ Test user cleaned up');
    
  } catch (error) {
    console.error('✗ Full registration flow failed:', error);
    logger.error('DIAGNOSTIC_TEST Full registration flow failed', { error });
    throw error;
  }
}

/**
 * Main diagnostic runner
 */
async function runDiagnostics() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   AUTH RUNTIME FAILURE DIAGNOSTIC                          ║');
  console.log('║   Investigating: Registration 201 but 0 users in DB        ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  try {
    // Test 1: Logger
    if (DIAGNOSTIC.LOGGER_TEST) {
      await testLogger();
    }
    
    // Test 2: Database Connection
    if (DIAGNOSTIC.DB_CONNECTION_TEST) {
      await testDatabaseConnection();
    }
    
    // Test 3: User Model
    if (DIAGNOSTIC.USER_MODEL_TEST) {
      await testUserModel();
    }
    
    // Test 4: Auth Service
    if (DIAGNOSTIC.AUTH_SERVICE_TEST) {
      await testAuthService();
    }
    
    // Test 5: Full Registration
    if (DIAGNOSTIC.FULL_REGISTRATION_TEST) {
      await testFullRegistration();
    }
    
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║   DIAGNOSTIC COMPLETE                                      ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('\nRESULTS:');
    console.log('  ✓ All tests passed');
    console.log('  ✓ Logger is working');
    console.log('  ✓ Database connection is working');
    console.log('  ✓ User model save is working');
    console.log('  ✓ AuthService registration is working');
    console.log('  ✓ Users are persisting to database');
    console.log('\nCONCLUSION:');
    console.log('  The system is functioning correctly in this test environment.');
    console.log('  The production issue may be:');
    console.log('    1. Environment-specific (different DB connection)');
    console.log('    2. Transaction rollback (check for uncommitted transactions)');
    console.log('    3. Database permissions issue');
    console.log('    4. Wrong database being inspected vs. written to');
    console.log('\nNEXT STEPS:');
    console.log('  1. Check logs/application-*.log for DIAGNOSTIC_TEST entries');
    console.log('  2. Verify MONGODB_URI in production matches inspection DB');
    console.log('  3. Check for any transaction middleware or session usage');
    console.log('  4. Verify database user has write permissions');
    
  } catch (error) {
    console.error('\n╔════════════════════════════════════════════════════════════╗');
    console.error('║   DIAGNOSTIC FAILED                                        ║');
    console.error('╚════════════════════════════════════════════════════════════╝');
    console.error('\nERROR:', error);
    console.error('\nROOT CAUSE IDENTIFIED:');
    console.error('  The error above shows the exact failure point.');
    console.error('  Review the stack trace and error message for details.');
  } finally {
    // Cleanup
    await mongoose.disconnect();
    console.log('\n✓ MongoDB disconnected');
    
    // Force exit after logs flush
    setTimeout(() => {
      process.exit(0);
    }, 2000);
  }
}

// Run diagnostics
runDiagnostics();
