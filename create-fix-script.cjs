const fs = require('fs');
const path = require('path');

const scriptPath = path.join(__dirname, 'apps', 'backend', 'scripts', 'production-launch.cjs');
const content = fs.readFileSync(scriptPath, 'utf8');
const fixed = content.replace(
  "path.join(__dirname, '../../docker-compose.production.yml')",
  "path.join(__dirname, '../../../docker-compose.production.yml')"
);

const outputPath = path.join(__dirname, 'apps', 'backend', 'scripts', 'production-launch-fixed.cjs');
fs.writeFileSync(outputPath, fixed);
console.log('Fixed script created at:', outputPath);
