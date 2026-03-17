/**
 * Production Load Simulator for Authentication System
 * 
 * Simulates realistic SaaS authentication traffic patterns:
 * - 70% refresh token requests
 * - 20% login requests  
 * - 10% logout requests
 * 
 * Tests with 100, 300, and 800 concurrent users for 15 minutes each
 */

const axios = require('axios');
const { performance } = require('perf_hooks');
const os = require('os');

class ProductionLoadSimulator {
  constructor() {
    this.baseUrl = 'http://localhost:5000/api/v1';
    this.testUsers = [];
    this.activeSessions = new Map(); // userId -> { accessToken, refreshToken }
    this.metrics = {
      requests: {
        total: 0,
        login: { success: 0, failed: 0, rateLimited: 0 },
        refresh: { success: 0, failed: 0, rateLimited: 0 },
        logout: { success: 0, failed: 0, rateLimited: 0 }
      },
      failures: {
        rateLimited: 0,
        invalidCredentials: 0,
        timeout: 0,
        databaseFailure: 0,
        serverException: 0,
        tokenExpired: 0,
        networkError: 0
      },
      performance: {
        responseTimes: [],
        peakMemory: 0,
        avgCpu: 0,
        samples: []
      },
      resources: {
        dbConnections: [],
        redisUsage: [],
        memoryUsage: []
      }
    };
    
    this.isRunning = false;
    this.startTime = 0;
  }

  async initialize() {
    console.log('🚀 Initializing Production Load Simulator...');
    
    // Create test users for simulation
    await this.createTestUsers(1000); // Create pool of test users
    console.log(`✅ Created ${this.testUsers.length} test users`);
  }

  async createTestUsers(count) {
    console.log(`👥 Creating ${count} test users...`);
    
    for (let i = 0; i < count; i++) {
      this.testUsers.push({
        id: i,
        email: `loadtest-user-${i}@example.com`,
        password: 'LoadTest123!',
        isLoggedIn: false
      });
    }
  }

  async runLoadTest(concurrentUsers, durationMinutes = 15) {
    console.log(`\n🔥 Starting load test: ${concurrentUsers} concurrent users for ${durationMinutes} minutes`);
    console.log('📊 Traffic Mix: 70% refresh, 20% login, 10% logout');
    
    this.isRunning = true;
    this.startTime = Date.now();
    const endTime = this.startTime + (durationMinutes * 60 * 1000);
    
    // Start performance monitoring
    const monitoringInterval = setInterval(() => {
      this.collectPerformanceMetrics();
    }, 5000); // Every 5 seconds
    
    // Create concurrent user sessions
    const userPromises = [];
    for (let i = 0; i < concurrentUsers; i++) {
      const user = this.testUsers[i % this.testUsers.length];
      userPromises.push(this.simulateUserSession(user, endTime));
    }
    
    // Wait for all sessions to complete
    await Promise.all(userPromises);
    
    clearInterval(monitoringInterval);
    this.isRunning = false;
    
    const actualDuration = (Date.now() - this.startTime) / 1000;
    console.log(`✅ Load test completed in ${actualDuration.toFixed(1)}s`);
    
    return this.generateReport(concurrentUsers, actualDuration);
  }

  async simulateUserSession(user, endTime) {
    const userId = `user-${user.id}`;
    
    while (Date.now() < endTime && this.isRunning) {
      try {
        // Determine action based on traffic mix and user state
        const action = this.selectUserAction(userId);
        
        const startTime = performance.now();
        let result;
        
        switch (action) {
          case 'login':
            result = await this.performLogin(user, userId);
            break;
          case 'refresh':
            result = await this.performRefresh(userId);
            break;
          case 'logout':
            result = await this.performLogout(userId);
            break;
        }
        
        const responseTime = performance.now() - startTime;
        this.recordMetrics(action, result, responseTime);
        
        // Random delay between requests (1-5 seconds)
        await this.sleep(1000 + Math.random() * 4000);
        
      } catch (error) {
        this.recordFailure('networkError', error);
      }
    }
  }

  selectUserAction(userId) {
    const isLoggedIn = this.activeSessions.has(userId);
    const random = Math.random();
    
    if (!isLoggedIn) {
      return 'login'; // Must login first
    }
    
    // Traffic mix for logged-in users
    if (random < 0.70) {
      return 'refresh'; // 70% refresh
    } else if (random < 0.90) {
      return 'login'; // 20% login (re-login)
    } else {
      return 'logout'; // 10% logout
    }
  }
  async performLogin(user, userId) {
    try {
      const response = await axios.post(`${this.baseUrl}/auth/login`, {
        email: user.email,
        password: user.password
      }, {
        timeout: 10000,
        validateStatus: () => true
      });

      if (response.status === 200) {
        // Extract tokens
        const accessToken = response.data.accessToken;
        const refreshToken = this.extractRefreshToken(response.headers['set-cookie']);
        
        if (accessToken && refreshToken) {
          this.activeSessions.set(userId, { accessToken, refreshToken });
          return { success: true, status: response.status };
        }
      } else if (response.status === 429) {
        return { success: false, status: response.status, type: 'rateLimited' };
      } else if (response.status === 401) {
        return { success: false, status: response.status, type: 'invalidCredentials' };
      }
      
      return { success: false, status: response.status, type: 'serverException' };
      
    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        return { success: false, type: 'timeout' };
      }
      return { success: false, type: 'networkError' };
    }
  }

  async performRefresh(userId) {
    const session = this.activeSessions.get(userId);
    if (!session) {
      return { success: false, type: 'noSession' };
    }

    try {
      const response = await axios.post(`${this.baseUrl}/auth/refresh`, {}, {
        headers: {
          'Cookie': `refreshToken=${session.refreshToken}`
        },
        timeout: 10000,
        validateStatus: () => true
      });

      if (response.status === 200) {
        // Update tokens
        const newAccessToken = response.data.accessToken;
        const newRefreshToken = this.extractRefreshToken(response.headers['set-cookie']);
        
        if (newAccessToken && newRefreshToken) {
          this.activeSessions.set(userId, { 
            accessToken: newAccessToken, 
            refreshToken: newRefreshToken 
          });
          return { success: true, status: response.status };
        }
      } else if (response.status === 429) {
        return { success: false, status: response.status, type: 'rateLimited' };
      } else if (response.status === 401) {
        // Token expired or invalid, remove session
        this.activeSessions.delete(userId);
        return { success: false, status: response.status, type: 'tokenExpired' };
      }
      
      return { success: false, status: response.status, type: 'serverException' };
      
    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        return { success: false, type: 'timeout' };
      }
      return { success: false, type: 'networkError' };
    }
  }

  async performLogout(userId) {
    const session = this.activeSessions.get(userId);
    if (!session) {
      return { success: false, type: 'noSession' };
    }

    try {
      const response = await axios.post(`${this.baseUrl}/auth/logout`, {}, {
        headers: {
          'Authorization': `Bearer ${session.accessToken}`
        },
        timeout: 10000,
        validateStatus: () => true
      });

      // Remove session regardless of response
      this.activeSessions.delete(userId);

      if (response.status === 200) {
        return { success: true, status: response.status };
      } else if (response.status === 429) {
        return { success: false, status: response.status, type: 'rateLimited' };
      }
      
      return { success: false, status: response.status, type: 'serverException' };
      
    } catch (error) {
      // Still remove session on error
      this.activeSessions.delete(userId);
      
      if (error.code === 'ECONNABORTED') {
        return { success: false, type: 'timeout' };
      }
      return { success: false, type: 'networkError' };
    }
  }

  extractRefreshToken(cookies) {
    if (!cookies) return null;
    
    const refreshCookie = cookies.find(cookie => 
      cookie.startsWith('refreshToken=')
    );
    
    if (refreshCookie) {
      return refreshCookie.split(';')[0].split('=')[1];
    }
    
    return null;
  }

  recordMetrics(action, result, responseTime) {
    this.metrics.requests.total++;
    this.metrics.performance.responseTimes.push(responseTime);
    
    if (result.success) {
      this.metrics.requests[action].success++;
    } else {
      this.metrics.requests[action].failed++;
      
      if (result.type === 'rateLimited') {
        this.metrics.requests[action].rateLimited++;
        this.metrics.failures.rateLimited++;
      } else {
        this.recordFailure(result.type);
      }
    }
  }

  recordFailure(type, error = null) {
    if (this.metrics.failures[type] !== undefined) {
      this.metrics.failures[type]++;
    } else {
      this.metrics.failures.serverException++;
    }
  }
  collectPerformanceMetrics() {
    const memUsage = process.memoryUsage();
    const cpuUsage = this.getCpuUsage();
    
    const sample = {
      timestamp: Date.now(),
      memory: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        rss: memUsage.rss,
        external: memUsage.external
      },
      cpu: cpuUsage,
      activeSessions: this.activeSessions.size,
      requestsPerSecond: this.calculateRequestsPerSecond()
    };
    
    this.metrics.performance.samples.push(sample);
    
    // Update peaks
    if (memUsage.heapUsed > this.metrics.performance.peakMemory) {
      this.metrics.performance.peakMemory = memUsage.heapUsed;
    }
    
    // Keep only last 200 samples
    if (this.metrics.performance.samples.length > 200) {
      this.metrics.performance.samples.shift();
    }
  }

  getCpuUsage() {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    return Math.max(0, 100 - Math.floor(100 * idle / total));
  }

  calculateRequestsPerSecond() {
    const now = Date.now();
    const timeWindow = 5000; // 5 seconds
    const recentSamples = this.metrics.performance.samples.filter(
      sample => now - sample.timestamp < timeWindow
    );
    
    if (recentSamples.length < 2) return 0;
    
    const oldestSample = recentSamples[0];
    const requestsDiff = this.metrics.requests.total - (oldestSample.totalRequests || 0);
    const timeDiff = (now - oldestSample.timestamp) / 1000;
    
    return timeDiff > 0 ? Math.round(requestsDiff / timeDiff) : 0;
  }

  generateReport(concurrentUsers, duration) {
    const report = {
      testConfig: {
        concurrentUsers,
        duration: `${duration.toFixed(1)}s`,
        trafficMix: '70% refresh, 20% login, 10% logout'
      },
      performance: this.calculatePerformanceMetrics(),
      authentication: this.calculateAuthMetrics(),
      failures: this.analyzeFailures(),
      resources: this.analyzeResourceUsage(),
      recommendations: this.generateRecommendations()
    };
    
    this.printReport(report);
    return report;
  }

  calculatePerformanceMetrics() {
    const responseTimes = this.metrics.performance.responseTimes;
    responseTimes.sort((a, b) => a - b);
    
    const totalRequests = this.metrics.requests.total;
    const successfulRequests = 
      this.metrics.requests.login.success +
      this.metrics.requests.refresh.success +
      this.metrics.requests.logout.success;
    
    return {
      totalRequests,
      successfulRequests,
      successRate: totalRequests > 0 ? (successfulRequests / totalRequests * 100).toFixed(2) + '%' : '0%',
      avgResponseTime: responseTimes.length > 0 ? 
        (responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length).toFixed(2) + 'ms' : '0ms',
      p50ResponseTime: responseTimes.length > 0 ? 
        responseTimes[Math.floor(responseTimes.length * 0.5)].toFixed(2) + 'ms' : '0ms',
      p95ResponseTime: responseTimes.length > 0 ? 
        responseTimes[Math.floor(responseTimes.length * 0.95)].toFixed(2) + 'ms' : '0ms',
      p99ResponseTime: responseTimes.length > 0 ? 
        responseTimes[Math.floor(responseTimes.length * 0.99)].toFixed(2) + 'ms' : '0ms',
      maxResponseTime: responseTimes.length > 0 ? 
        Math.max(...responseTimes).toFixed(2) + 'ms' : '0ms'
    };
  }

  calculateAuthMetrics() {
    const login = this.metrics.requests.login;
    const refresh = this.metrics.requests.refresh;
    const logout = this.metrics.requests.logout;
    
    return {
      login: {
        total: login.success + login.failed,
        success: login.success,
        failed: login.failed,
        rateLimited: login.rateLimited,
        successRate: (login.success + login.failed) > 0 ? 
          (login.success / (login.success + login.failed) * 100).toFixed(2) + '%' : '0%'
      },
      refresh: {
        total: refresh.success + refresh.failed,
        success: refresh.success,
        failed: refresh.failed,
        rateLimited: refresh.rateLimited,
        successRate: (refresh.success + refresh.failed) > 0 ? 
          (refresh.success / (refresh.success + refresh.failed) * 100).toFixed(2) + '%' : '0%'
      },
      logout: {
        total: logout.success + logout.failed,
        success: logout.success,
        failed: logout.failed,
        rateLimited: logout.rateLimited,
        successRate: (logout.success + logout.failed) > 0 ? 
          (logout.success / (logout.success + logout.failed) * 100).toFixed(2) + '%' : '0%'
      },
      tokenRotation: {
        working: refresh.success > 0,
        rotations: refresh.success
      },
      sessionManagement: {
        activeSessions: this.activeSessions.size,
        peakSessions: Math.max(...this.metrics.performance.samples.map(s => s.activeSessions || 0))
      }
    };
  }
  analyzeFailures() {
    const totalFailures = Object.values(this.metrics.failures).reduce((a, b) => a + b, 0);
    
    return {
      total: totalFailures,
      breakdown: {
        rateLimited: this.metrics.failures.rateLimited,
        invalidCredentials: this.metrics.failures.invalidCredentials,
        timeout: this.metrics.failures.timeout,
        databaseFailure: this.metrics.failures.databaseFailure,
        serverException: this.metrics.failures.serverException,
        tokenExpired: this.metrics.failures.tokenExpired,
        networkError: this.metrics.failures.networkError
      },
      percentages: Object.entries(this.metrics.failures).reduce((acc, [key, value]) => {
        acc[key] = totalFailures > 0 ? (value / totalFailures * 100).toFixed(2) + '%' : '0%';
        return acc;
      }, {})
    };
  }

  analyzeResourceUsage() {
    const samples = this.metrics.performance.samples;
    if (samples.length === 0) {
      return {
        memory: { peak: '0MB', average: '0MB' },
        cpu: { peak: '0%', average: '0%' },
        sessions: { peak: 0, average: 0 }
      };
    }
    
    const memoryValues = samples.map(s => s.memory.heapUsed);
    const cpuValues = samples.map(s => s.cpu);
    const sessionValues = samples.map(s => s.activeSessions);
    
    return {
      memory: {
        peak: this.formatBytes(Math.max(...memoryValues)),
        average: this.formatBytes(memoryValues.reduce((a, b) => a + b, 0) / memoryValues.length),
        rss: this.formatBytes(samples[samples.length - 1]?.memory.rss || 0)
      },
      cpu: {
        peak: Math.max(...cpuValues).toFixed(1) + '%',
        average: (cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length).toFixed(1) + '%'
      },
      sessions: {
        peak: Math.max(...sessionValues),
        average: Math.round(sessionValues.reduce((a, b) => a + b, 0) / sessionValues.length),
        current: this.activeSessions.size
      }
    };
  }

  generateRecommendations() {
    const recommendations = [];
    const performance = this.calculatePerformanceMetrics();
    const resources = this.analyzeResourceUsage();
    const failures = this.analyzeFailures();
    
    // Performance recommendations
    const avgResponseTime = parseFloat(performance.avgResponseTime);
    if (avgResponseTime > 2000) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        issue: 'High average response time',
        recommendation: 'Consider database query optimization or connection pooling'
      });
    }
    
    const p95ResponseTime = parseFloat(performance.p95ResponseTime);
    if (p95ResponseTime > 5000) {
      recommendations.push({
        type: 'performance',
        priority: 'medium',
        issue: 'High P95 response time',
        recommendation: 'Investigate slow queries and add database indexes'
      });
    }
    
    // Memory recommendations
    const peakMemoryMB = parseInt(resources.memory.peak);
    if (peakMemoryMB > 500) {
      recommendations.push({
        type: 'resource',
        priority: 'medium',
        issue: 'High memory usage',
        recommendation: 'Monitor for memory leaks and optimize object creation'
      });
    }
    
    // Failure rate recommendations
    const successRate = parseFloat(performance.successRate);
    if (successRate < 95) {
      recommendations.push({
        type: 'reliability',
        priority: 'high',
        issue: 'Low success rate',
        recommendation: 'Investigate failure causes and improve error handling'
      });
    }
    
    // Rate limiting recommendations
    if (this.metrics.failures.rateLimited > this.metrics.requests.total * 0.3) {
      recommendations.push({
        type: 'capacity',
        priority: 'medium',
        issue: 'High rate limiting',
        recommendation: 'Consider increasing rate limits or implementing request queuing'
      });
    }
    
    if (recommendations.length === 0) {
      recommendations.push({
        type: 'general',
        priority: 'info',
        issue: 'No issues detected',
        recommendation: 'System performing well under current load'
      });
    }
    
    return recommendations;
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0MB';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + sizes[i];
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  printReport(report) {
    console.log('\n' + '='.repeat(80));
    console.log('📊 PRODUCTION LOAD SIMULATION REPORT');
    console.log('='.repeat(80));
    
    // Test Configuration
    console.log('\n🔧 Test Configuration:');
    console.log(`   Concurrent Users: ${report.testConfig.concurrentUsers}`);
    console.log(`   Duration: ${report.testConfig.duration}`);
    console.log(`   Traffic Mix: ${report.testConfig.trafficMix}`);
    
    // Performance Metrics
    console.log('\n⚡ Performance Metrics:');
    console.log(`   Total Requests: ${report.performance.totalRequests}`);
    console.log(`   Successful Requests: ${report.performance.successfulRequests}`);
    console.log(`   Success Rate: ${report.performance.successRate}`);
    console.log(`   Average Response Time: ${report.performance.avgResponseTime}`);
    console.log(`   P50 Response Time: ${report.performance.p50ResponseTime}`);
    console.log(`   P95 Response Time: ${report.performance.p95ResponseTime}`);
    console.log(`   P99 Response Time: ${report.performance.p99ResponseTime}`);
    console.log(`   Max Response Time: ${report.performance.maxResponseTime}`);
    
    // Authentication Metrics
    console.log('\n🔐 Authentication Metrics:');
    console.log(`   Login Success Rate: ${report.authentication.login.successRate} (${report.authentication.login.success}/${report.authentication.login.total})`);
    console.log(`   Refresh Success Rate: ${report.authentication.refresh.successRate} (${report.authentication.refresh.success}/${report.authentication.refresh.total})`);
    console.log(`   Logout Success Rate: ${report.authentication.logout.successRate} (${report.authentication.logout.success}/${report.authentication.logout.total})`);
    console.log(`   Token Rotations: ${report.authentication.tokenRotation.rotations}`);
    console.log(`   Peak Active Sessions: ${report.authentication.sessionManagement.peakSessions}`);
    console.log(`   Current Active Sessions: ${report.authentication.sessionManagement.activeSessions}`);
    
    // Failure Analysis
    console.log('\n❌ Failure Analysis:');
    console.log(`   Total Failures: ${report.failures.total}`);
    if (report.failures.total > 0) {
      console.log('   Breakdown:');
      Object.entries(report.failures.breakdown).forEach(([type, count]) => {
        if (count > 0) {
          console.log(`     ${type}: ${count} (${report.failures.percentages[type]})`);
        }
      });
    }
    
    // Resource Usage
    console.log('\n💾 Resource Usage:');
    console.log(`   Peak Memory: ${report.resources.memory.peak}`);
    console.log(`   Average Memory: ${report.resources.memory.average}`);
    console.log(`   RSS Memory: ${report.resources.memory.rss}`);
    console.log(`   Peak CPU: ${report.resources.cpu.peak}`);
    console.log(`   Average CPU: ${report.resources.cpu.average}`);
    
    // Recommendations
    console.log('\n💡 Recommendations:');
    report.recommendations.forEach((rec, index) => {
      const priority = rec.priority === 'high' ? '🚨' : rec.priority === 'medium' ? '⚠️' : 'ℹ️';
      console.log(`   ${priority} [${rec.type.toUpperCase()}] ${rec.issue}`);
      console.log(`      → ${rec.recommendation}`);
    });
    
    console.log('\n' + '='.repeat(80));
  }

  async runFullSimulation() {
    console.log('🚀 Starting Full Production Load Simulation');
    console.log('Testing with 100, 300, and 800 concurrent users for 15 minutes each\n');
    
    await this.initialize();
    
    const testConfigs = [
      { users: 100, duration: 15 },
      { users: 300, duration: 15 },
      { users: 800, duration: 15 }
    ];
    
    const allReports = [];
    
    for (const config of testConfigs) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🎯 TESTING ${config.users} CONCURRENT USERS`);
      console.log(`${'='.repeat(60)}`);
      
      // Reset metrics for each test
      this.resetMetrics();
      
      const report = await this.runLoadTest(config.users, config.duration);
      allReports.push(report);
      
      // Cool down between tests
      if (config !== testConfigs[testConfigs.length - 1]) {
        console.log('\n⏸️  Cooling down for 30 seconds...');
        await this.sleep(30000);
      }
    }
    
    this.generateComparisonReport(allReports);
    return allReports;
  }

  resetMetrics() {
    this.metrics = {
      requests: {
        total: 0,
        login: { success: 0, failed: 0, rateLimited: 0 },
        refresh: { success: 0, failed: 0, rateLimited: 0 },
        logout: { success: 0, failed: 0, rateLimited: 0 }
      },
      failures: {
        rateLimited: 0,
        invalidCredentials: 0,
        timeout: 0,
        databaseFailure: 0,
        serverException: 0,
        tokenExpired: 0,
        networkError: 0
      },
      performance: {
        responseTimes: [],
        peakMemory: 0,
        avgCpu: 0,
        samples: []
      },
      resources: {
        dbConnections: [],
        redisUsage: [],
        memoryUsage: []
      }
    };
    
    this.activeSessions.clear();
  }

  generateComparisonReport(reports) {
    console.log('\n' + '='.repeat(80));
    console.log('📈 LOAD SIMULATION COMPARISON REPORT');
    console.log('='.repeat(80));
    
    console.log('\n📊 Performance Comparison:');
    console.log('Users\tSuccess Rate\tAvg Response\tP95 Response\tPeak Memory\tPeak CPU');
    console.log('-'.repeat(80));
    
    reports.forEach(report => {
      console.log(
        `${report.testConfig.concurrentUsers}\t${report.performance.successRate}\t\t${report.performance.avgResponseTime}\t\t${report.performance.p95ResponseTime}\t\t${report.resources.memory.peak}\t${report.resources.cpu.peak}`
      );
    });
    
    console.log('\n🎯 Key Findings:');
    
    // Analyze trends
    const successRates = reports.map(r => parseFloat(r.performance.successRate));
    const avgResponseTimes = reports.map(r => parseFloat(r.performance.avgResponseTime));
    const peakMemories = reports.map(r => parseInt(r.resources.memory.peak));
    
    if (successRates.every(rate => rate > 95)) {
      console.log('   ✅ System maintains high success rate across all load levels');
    } else {
      console.log('   ⚠️  Success rate degrades under higher load');
    }
    
    if (avgResponseTimes[2] > avgResponseTimes[0] * 3) {
      console.log('   ⚠️  Response time increases significantly under high load');
    } else {
      console.log('   ✅ Response times remain reasonable under load');
    }
    
    if (peakMemories[2] > peakMemories[0] * 2) {
      console.log('   ⚠️  Memory usage scales non-linearly with load');
    } else {
      console.log('   ✅ Memory usage scales appropriately with load');
    }
    
    console.log('\n' + '='.repeat(80));
  }
}

// Main execution
async function main() {
  const simulator = new ProductionLoadSimulator();
  
  try {
    await simulator.runFullSimulation();
  } catch (error) {
    console.error('❌ Load simulation failed:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Load simulation interrupted');
  process.exit(0);
});

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = ProductionLoadSimulator;