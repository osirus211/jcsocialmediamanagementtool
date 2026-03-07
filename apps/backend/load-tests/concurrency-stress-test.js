#!/usr/bin/env node
/**
 * Concurrency Stress Test
 * 
 * Simulates 300-1000 concurrent OAuth state operations
 * Monitors Redis performance under load
 */

const axios = require('axios');
const { performance } = require('perf_hooks');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';
const CONCURRENT_CREATES = parseInt(process.env.CONCURRENT_CREATES || '1000', 10);
const CONCURRENT_CONSUMES = parseInt(process.env.CONCURRENT_CONSUMES || '1000', 10);
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);

const Redis = require('ioredis');
const redis = new Redis({ host: REDIS_HOST, port: REDIS_PORT });

const metrics = {
  creates: { success: 0, failed: 0, latencies: [] },
  consumes: { success: 0, failed: 0, latencies: [] },
  redis: { cpu: [], memory: [], connections: [] },
};

/**
 * Monitor Redis metrics
 */
async function monitorRedis() {
  try {
    const info = await redis.info();
    const lines = info.split('\r\n');
    
    const cpuLine = lines.find(l => l.startsWith('used_cpu_sys:'));
    const memLine = lines.find(l => l.startsWith('used_memory:'));
    const connLine = lines.find(l => l.startsWith('connected_clients:'));
    
    if (cpuLine) metrics.redis.cpu.push(parseFloat(cpuLine.split(':')[1]));
    if (memLine) metrics.redis.memory.push(parseInt(memLine.split(':')[1], 10));
    if (connLine) metrics.redis.connections.push(parseInt(connLine.split(':')[1], 10));
  } catch (error) {
    console.error('Redis monitoring error:', error.message);
  }
}

/**
 * Create OAuth state
 */
async function createState(id) {
  const start = performance.now();
  
  try {
    await axios.post(`${BACKEND_URL}/api/v1/oauth/twitter/authorize`, {}, {
      headers: {
        'Authorization': 'Bearer test-token',
        'X-Workspace-ID': 'stress-test-workspace',
        'X-User-ID': `stress-user-${id}`,
      },
    });
    
    const latency = performance.now() - start;
    metrics.creates.latencies.push(latency);
    metrics.creates.success++;
    
    return { success: true, latency };
  } catch (error) {
    metrics.creates.failed++;
    return { success: false, error: error.message };
  }
}

/**
 * Consume OAuth state
 */
async function consumeState(state, id) {
  const start = performance.now();
  
  try {
    await axios.get(`${BACKEND_URL}/api/v1/oauth/twitter/callback`, {
      params: { code: `test-code-${id}`, state },
      maxRedirects: 0,
      validateStatus: (status) => status < 400,
    });
    
    const latency = performance.now() - start;
    metrics.consumes.latencies.push(latency);
    metrics.consumes.success++;
    
    return { success: true, latency };
  } catch (error) {
    metrics.consumes.failed++;
    return { success: false, error: error.message };
  }
}

/**
 * Run concurrent creates
 */
async function runConcurrentCreates() {
  console.log(`\n🔥 Creating ${CONCURRENT_CREATES} states concurrently...`);
  
  const promises = [];
  for (let i = 0; i < CONCURRENT_CREATES; i++) {
    promises.push(createState(i));
  }
  
  const results = await Promise.all(promises);
  
  console.log(`✅ Creates: ${metrics.creates.success} success, ${metrics.creates.failed} failed`);
  
  return results.filter(r => r.success).map((r, i) => ({ id: i, state: r.state }));
}

/**
 * Run concurrent consumes
 */
async function runConcurrentConsumes(states) {
  console.log(`\n🔥 Consuming ${states.length} states concurrently...`);
  
  const promises = states.map(({ id, state }) => consumeState(state, id));
  await Promise.all(promises);
  
  console.log(`✅ Consumes: ${metrics.consumes.success} success, ${metrics.consumes.failed} failed`);
}

/**
 * Calculate percentiles
 */
function calculatePercentiles(latencies) {
  const sorted = latencies.sort((a, b) => a - b);
  return {
    p50: sorted[Math.floor(sorted.length * 0.5)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    p99: sorted[Math.floor(sorted.length * 0.99)],
    max: sorted[sorted.length - 1],
  };
}

/**
 * Print results
 */
function printResults() {
  console.log('\n' + '='.repeat(80));
  console.log('CONCURRENCY STRESS TEST RESULTS');
  console.log('='.repeat(80));
  
  const createStats = calculatePercentiles(metrics.creates.latencies);
  const consumeStats = calculatePercentiles(metrics.consumes.latencies);
  
  console.log('\n📊 State Creation:');
  console.log(`  Success:     ${metrics.creates.success}`);
  console.log(`  Failed:      ${metrics.creates.failed}`);
  console.log(`  P50 Latency: ${createStats.p50.toFixed(2)}ms`);
  console.log(`  P95 Latency: ${createStats.p95.toFixed(2)}ms`);
  console.log(`  P99 Latency: ${createStats.p99.toFixed(2)}ms`);
  console.log(`  Max Latency: ${createStats.max.toFixed(2)}ms`);
  
  console.log('\n📊 State Consumption:');
  console.log(`  Success:     ${metrics.consumes.success}`);
  console.log(`  Failed:      ${metrics.consumes.failed}`);
  console.log(`  P50 Latency: ${consumeStats.p50.toFixed(2)}ms`);
  console.log(`  P95 Latency: ${consumeStats.p95.toFixed(2)}ms`);
  console.log(`  P99 Latency: ${consumeStats.p99.toFixed(2)}ms`);
  console.log(`  Max Latency: ${consumeStats.max.toFixed(2)}ms`);
  
  if (metrics.redis.cpu.length > 0) {
    const avgCpu = metrics.redis.cpu.reduce((a, b) => a + b, 0) / metrics.redis.cpu.length;
    const maxCpu = Math.max(...metrics.redis.cpu);
    const avgMem = metrics.redis.memory.reduce((a, b) => a + b, 0) / metrics.redis.memory.length;
    const maxMem = Math.max(...metrics.redis.memory);
    const avgConn = metrics.redis.connections.reduce((a, b) => a + b, 0) / metrics.redis.connections.length;
    const maxConn = Math.max(...metrics.redis.connections);
    
    console.log('\n🔴 Redis Metrics:');
    console.log(`  Avg CPU:         ${avgCpu.toFixed(2)}s`);
    console.log(`  Max CPU:         ${maxCpu.toFixed(2)}s`);
    console.log(`  Avg Memory:      ${(avgMem / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  Max Memory:      ${(maxMem / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  Avg Connections: ${avgConn.toFixed(0)}`);
    console.log(`  Max Connections: ${maxConn}`);
  }
  
  console.log('\n' + '='.repeat(80));
  
  // Go/No-Go
  const createSuccess = (metrics.creates.success / CONCURRENT_CREATES) * 100;
  const consumeSuccess = (metrics.consumes.success / CONCURRENT_CONSUMES) * 100;
  const goNoGo = createSuccess >= 99.9 && consumeSuccess >= 99.9 && createStats.p99 < 2000 && consumeStats.p99 < 2000;
  
  console.log(goNoGo ? '✅ GO: System handles concurrency well' : '❌ NO-GO: Performance issues detected');
  console.log('='.repeat(80) + '\n');
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Starting Concurrency Stress Test');
  console.log(`   Concurrent Creates: ${CONCURRENT_CREATES}`);
  console.log(`   Concurrent Consumes: ${CONCURRENT_CONSUMES}`);
  
  // Start Redis monitoring
  const monitorInterval = setInterval(monitorRedis, 1000);
  
  try {
    // Run concurrent creates
    const states = await runConcurrentCreates();
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Run concurrent consumes
    await runConcurrentConsumes(states);
    
    // Stop monitoring
    clearInterval(monitorInterval);
    
    // Print results
    printResults();
    
    process.exit(0);
  } catch (error) {
    clearInterval(monitorInterval);
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    redis.disconnect();
  }
}

if (require.main === module) {
  main();
}
