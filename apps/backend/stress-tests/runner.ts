import mongoose from 'mongoose';
import Redis from 'ioredis';
import { createInterface } from 'readline';
import { seedStressTestData, SeedData } from './seed';
import { cleanupStressTestData } from './cleanup';
import { WorkspaceStressTests } from './workspace.stress';

interface TestResult {
  name: string;
  passed: boolean;
  metrics: string;
  error?: string;
}

class StressTestRunner {
  private seedData: SeedData | null = null;
  private cleanupRegistered = false;

  async preFlightChecks(): Promise<boolean> {
    console.log('🔍 Running pre-flight checks...\n');

    // Check server health
    try {
      const response = await fetch('http://localhost:5000/health');
      if (response.status !== 200) {
        console.error('❌ Server health check failed');
        console.log('Start server first: npm run dev');
        return false;
      }
      console.log('✅ Server health check passed');
    } catch (error) {
      console.error('❌ Server not reachable at localhost:5000');
      console.log('Start server first: npm run dev');
      return false;
    }

    // Check MongoDB
    try {
      await mongoose.connect('mongodb://localhost:27017/jcsocial_stress_test');
      console.log('✅ MongoDB connection successful');
      await mongoose.disconnect();
    } catch (error) {
      console.error('❌ MongoDB not reachable:', error);
      return false;
    }

    // Check Redis (optional)
    try {
      const redis = new Redis({
        host: 'localhost',
        port: 6379,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3
      });
      await redis.ping();
      await redis.quit();
      console.log('✅ Redis connection successful');
    } catch (error) {
      console.warn('⚠️  Redis not reachable - Redis tests will be SKIPPED');
    }

    // Check for leftover stress_test_ data
    try {
      await mongoose.connect('mongodb://localhost:27017/jcsocial_stress_test');
      const db = mongoose.connection.db;
      
      const collections = ['users', 'workspaces', 'members', 'posts'];
      let foundLeftovers = false;
      
      for (const collectionName of collections) {
        const collection = db.collection(collectionName);
        const count = await collection.countDocuments({
          $or: [
            { name: { $regex: /^stress_test_/ } },
            { email: { $regex: /^stress_test_/ } },
            { slug: { $regex: /^stress_test_/ } }
          ]
        });
        
        if (count > 0) {
          console.warn(`⚠️  Found ${count} leftover stress_test_ documents in ${collectionName}`);
          foundLeftovers = true;
        }
      }
      
      await mongoose.disconnect();
      
      if (foundLeftovers) {
        console.log('\nClean leftover data before continuing? (y/n)');
        const answer = await this.waitForInput();
        if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
          await cleanupStressTestData();
        }
      }
    } catch (error) {
      console.error('❌ Failed to check for leftover data:', error);
      return false;
    }

    console.log('✅ Pre-flight checks completed\n');
    return true;
  }

  async waitForInput(): Promise<string> {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question('', (answer) => {
        rl.close();
        resolve(answer);
      });
    });
  }

  registerCleanupHandlers(): void {
    if (this.cleanupRegistered) return;
    
    const cleanup = async () => {
      console.log('\n🧹 Cleaning up stress test data...');
      try {
        await cleanupStressTestData();
        console.log('✅ Cleanup completed');
      } catch (error) {
        console.error('❌ Cleanup failed:', error);
      }
      process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    this.cleanupRegistered = true;
  }

  printResultsTable(results: TestResult[]): void {
    console.log('\n' + '='.repeat(80));
    console.log('📊 STRESS TEST RESULTS');
    console.log('='.repeat(80));
    
    console.log('┌──────┬──────────────────────────────────┬────────┬────────────────────────┐');
    console.log('│ Test │ Name                             │ Result │ Key Metric             │');
    console.log('├──────┼──────────────────────────────────┼────────┼────────────────────────┤');
    
    results.forEach((result, index) => {
      const testNum = (index + 1).toString().padStart(2);
      const name = result.name.padEnd(32);
      const status = result.passed ? '✅' : '❌';
      const metrics = result.metrics.padEnd(22);
      
      console.log(`│  ${testNum}  │ ${name} │ ${status}    │ ${metrics} │`);
    });
    
    console.log('└──────┴──────────────────────────────────┴────────┴────────────────────────┘');
    
    const passedCount = results.filter(r => r.passed).length;
    const totalCount = results.length;
    
    console.log(`\nTOTAL: ${passedCount}/${totalCount} passed`);
    
    const failedTests = results.filter(r => !r.passed);
    if (failedTests.length > 0) {
      console.log('\nFAILED TESTS:');
      failedTests.forEach((test, index) => {
        console.log(`${index + 1}. ${test.name}: ${test.metrics}`);
        if (test.error) {
          console.log(`   Recommended fix: ${test.error}`);
        }
      });
    }
    
    console.log('='.repeat(80));
  }

  async run(): Promise<void> {
    try {
      // Step 1: Pre-flight checks
      const checksPass = await this.preFlightChecks();
      if (!checksPass) {
        process.exit(1);
      }

      // Step 2: Print database name and wait for confirmation
      console.log('🎯 Target database: jcsocial_stress_test');
      console.log('Press ENTER to confirm and start stress tests...');
      await this.waitForInput();

      // Step 3: Seed data
      console.log('\n🌱 Seeding test data...');
      this.seedData = await seedStressTestData();

      // Step 4: Register cleanup handlers
      this.registerCleanupHandlers();

      // Step 5: Run tests
      console.log('\n🚀 Starting stress tests...');
      const stressTests = new WorkspaceStressTests(this.seedData);
      
      let results: TestResult[] = [];
      
      try {
        results = await stressTests.runAllTests();
      } catch (error) {
        console.error('❌ Stress tests aborted:', error);
        results.push({
          name: 'Test Suite',
          passed: false,
          metrics: 'N/A',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      // Step 6: Print results
      this.printResultsTable(results);

      // Step 7: Determine exit code
      const allPassed = results.every(r => r.passed);
      const exitCode = allPassed ? 0 : 1;
      
      console.log(`\n🏁 Tests completed with exit code: ${exitCode}`);
      
      // Cleanup will be handled by finally block
      process.exit(exitCode);

    } catch (error) {
      console.error('❌ Stress test runner failed:', error);
      process.exit(1);
    } finally {
      // Always cleanup, even on crash
      if (this.seedData) {
        console.log('\n🧹 Running final cleanup...');
        try {
          await cleanupStressTestData();
          console.log('✅ Final cleanup completed');
        } catch (error) {
          console.error('❌ Final cleanup failed:', error);
        }
      }
    }
  }
}

// Run the stress tests
const runner = new StressTestRunner();
runner.run().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});