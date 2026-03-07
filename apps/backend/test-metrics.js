/**
 * Quick test script for /metrics endpoint
 * 
 * Usage: node test-metrics.js
 */

const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/metrics',
  method: 'GET',
};

console.log('Testing /metrics endpoint...\n');

const req = http.request(options, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  console.log(`Content-Type: ${res.headers['content-type']}\n`);

  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('Response:\n');
    console.log(data);
    
    // Verify Prometheus format
    const hasHelp = data.includes('# HELP');
    const hasType = data.includes('# TYPE');
    const hasMetrics = data.includes('process_uptime_seconds');
    
    console.log('\n--- Validation ---');
    console.log(`✓ Has HELP comments: ${hasHelp}`);
    console.log(`✓ Has TYPE comments: ${hasType}`);
    console.log(`✓ Has metrics: ${hasMetrics}`);
    
    if (hasHelp && hasType && hasMetrics) {
      console.log('\n✅ Metrics endpoint working correctly!');
    } else {
      console.log('\n❌ Metrics endpoint has issues');
    }
  });
});

req.on('error', (error) => {
  console.error(`❌ Error: ${error.message}`);
  console.log('\nMake sure the server is running: npm run dev');
});

req.end();
