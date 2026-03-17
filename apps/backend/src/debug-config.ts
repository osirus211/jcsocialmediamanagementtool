
import { config } from './config';
import { logger } from './utils/logger';

console.log('--- Config Debug ---');
console.log('REDIS_HOST:', config.redis.host);
console.log('REDIS_PORT:', config.redis.port);
console.log('REDIS_PORT Type:', typeof config.redis.port);
console.log('PORT:', config.port);
console.log('PORT Type:', typeof config.port);
console.log('--------------------');
