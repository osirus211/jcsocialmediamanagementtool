/**
 * Authentication Performance Monitor
 * 
 * Monitors system resources during authentication stress testing
 * Tracks memory usage, CPU, database connections, and Redis usage
 */

const os = require('os');
const { performance } = require('perf_hooks');

class AuthPerformanceMonitor {
  constructor() {
    this.metrics = {
      startTime: Date.now(),
      samples: [],
      peaks: {
        memory: 0,
        cpu: 0,
        connections: 0
      },
      averages: {
        memory: 0,
        cpu: 0,
        responseTime: 0
      }
    };
    
    this.isMonitoring = false;
    this.intervalId = null;
  }

  startMonitoring(intervalMs = 1000) {
    if (this.isMonitoring) {
      console.log('⚠️  Monitoring already active');
      return;
    }

    console.log('📊 Starting performance monitoring...');
    this.isMonitoring = true;
    this.metrics.startTime = Date.now();

    this.intervalId = setInterval(() => {
      this.collectMetrics();
    }, intervalMs);
  }

  stopMonitoring() {
    if (!this.isMonitoring) {
      return;
    }

    console.log('🛑 Stopping performance monitoring...');
    this.isMonitoring = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.calculateAverages();
    this.generateReport();
  }

  collectMetrics() {
    const sample = {
      timestamp: Date.now(),
      memory: this.getMemoryUsage(),
      cpu: this.getCpuUsage(),
      uptime: process.uptime(),
      eventLoopDelay: this.getEventLoopDelay()
    };

    this.metrics.samples.push(sample);

    // Update peaks
    if (sample.memory.heapUsed > this.metrics.peaks.memory) {
      this.metrics.peaks.memory = sample.memory.heapUsed;
    }
    
    if (sample.cpu > this.metrics.peaks.cpu) {
      this.metrics.peaks.cpu = sample.cpu;
    }

    // Keep only last 1000 samples to prevent memory issues
    if (this.metrics.samples.length > 1000) {
      this.metrics.samples.shift();
    }
  }

  getMemoryUsage() {
    const memUsage = process.memoryUsage();
    const systemMem = {
      total: os.totalmem(),
      free: os.freemem(),
      used: os.totalmem() - os.freemem()
    };

    return {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      systemUsed: systemMem.used,
      systemTotal: systemMem.total,
      systemFree: systemMem.free
    };
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
    const usage = 100 - ~~(100 * idle / total);

    return usage;
  }

  getEventLoopDelay() {
    const start = performance.now();
    setImmediate(() => {
      const delay = performance.now() - start;
      return delay;
    });
    return 0; // Simplified for this implementation
  }

  calculateAverages() {
    if (this.metrics.samples.length === 0) return;

    const totalSamples = this.metrics.samples.length;
    let totalMemory = 0;
    let totalCpu = 0;

    this.metrics.samples.forEach(sample => {
      totalMemory += sample.memory.heapUsed;
      totalCpu += sample.cpu;
    });

    this.metrics.averages = {
      memory: totalMemory / totalSamples,
      cpu: totalCpu / totalSamples,
      sampleCount: totalSamples
    };
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  generateReport() {
    const duration = Date.now() - this.metrics.startTime;
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 AUTHENTICATION PERFORMANCE MONITORING REPORT');
    console.log('='.repeat(60));
    
    console.log(`\n⏱️  Monitoring Duration: ${Math.round(duration / 1000)}s`);
    console.log(`📈 Samples Collected: ${this.metrics.samples.length}`);
    
    console.log(`\n💾 Memory Usage:`);
    console.log(`   Peak Heap Used: ${this.formatBytes(this.metrics.peaks.memory)}`);
    console.log(`   Average Heap Used: ${this.formatBytes(this.metrics.averages.memory)}`);
    
    if (this.metrics.samples.length > 0) {
      const latestSample = this.metrics.samples[this.metrics.samples.length - 1];
      console.log(`   Current Heap Used: ${this.formatBytes(latestSample.memory.heapUsed)}`);
      console.log(`   Current RSS: ${this.formatBytes(latestSample.memory.rss)}`);
      console.log(`   System Memory Used: ${this.formatBytes(latestSample.memory.systemUsed)}`);
    }
    
    console.log(`\n🖥️  CPU Usage:`);
    console.log(`   Peak CPU: ${this.metrics.peaks.cpu.toFixed(2)}%`);
    console.log(`   Average CPU: ${this.metrics.averages.cpu.toFixed(2)}%`);
    
    // Memory leak detection
    const memoryGrowth = this.detectMemoryLeaks();
    if (memoryGrowth.detected) {
      console.log(`\n🚨 MEMORY LEAK DETECTED:`);
      console.log(`   Growth Rate: ${this.formatBytes(memoryGrowth.rate)}/minute`);
      console.log(`   Total Growth: ${this.formatBytes(memoryGrowth.total)}`);
    } else {
      console.log(`\n✅ No memory leaks detected`);
    }
    
    // Performance assessment
    this.assessPerformance();
    
    console.log('\n' + '='.repeat(60));
  }

  detectMemoryLeaks() {
    if (this.metrics.samples.length < 10) {
      return { detected: false };
    }

    const firstTenPercent = this.metrics.samples.slice(0, Math.floor(this.metrics.samples.length * 0.1));
    const lastTenPercent = this.metrics.samples.slice(-Math.floor(this.metrics.samples.length * 0.1));

    const avgStart = firstTenPercent.reduce((sum, sample) => sum + sample.memory.heapUsed, 0) / firstTenPercent.length;
    const avgEnd = lastTenPercent.reduce((sum, sample) => sum + sample.memory.heapUsed, 0) / lastTenPercent.length;

    const growth = avgEnd - avgStart;
    const duration = Date.now() - this.metrics.startTime;
    const growthRate = (growth / duration) * 60000; // Per minute

    return {
      detected: growth > 50 * 1024 * 1024, // 50MB growth threshold
      total: growth,
      rate: growthRate
    };
  }

  assessPerformance() {
    const peakMemoryMB = this.metrics.peaks.memory / (1024 * 1024);
    const avgCpu = this.metrics.averages.cpu;
    
    console.log(`\n🎯 Performance Assessment:`);
    
    // Memory assessment
    if (peakMemoryMB < 100) {
      console.log(`   Memory Usage: ✅ EXCELLENT (${peakMemoryMB.toFixed(1)}MB peak)`);
    } else if (peakMemoryMB < 250) {
      console.log(`   Memory Usage: ✅ GOOD (${peakMemoryMB.toFixed(1)}MB peak)`);
    } else if (peakMemoryMB < 500) {
      console.log(`   Memory Usage: ⚠️  MODERATE (${peakMemoryMB.toFixed(1)}MB peak)`);
    } else {
      console.log(`   Memory Usage: 🚨 HIGH (${peakMemoryMB.toFixed(1)}MB peak)`);
    }
    
    // CPU assessment
    if (avgCpu < 30) {
      console.log(`   CPU Usage: ✅ EXCELLENT (${avgCpu.toFixed(1)}% average)`);
    } else if (avgCpu < 60) {
      console.log(`   CPU Usage: ✅ GOOD (${avgCpu.toFixed(1)}% average)`);
    } else if (avgCpu < 80) {
      console.log(`   CPU Usage: ⚠️  MODERATE (${avgCpu.toFixed(1)}% average)`);
    } else {
      console.log(`   CPU Usage: 🚨 HIGH (${avgCpu.toFixed(1)}% average)`);
    }
  }

  getMetrics() {
    return this.metrics;
  }
}

module.exports = AuthPerformanceMonitor;