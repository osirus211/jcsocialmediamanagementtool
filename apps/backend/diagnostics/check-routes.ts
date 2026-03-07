/**
 * Check what routes are actually registered in the running app
 */

import app from '../src/app';

console.log('\n========================================');
console.log('CHECKING REGISTERED ROUTES');
console.log('========================================\n');

console.log('App router stack:');
let routeCount = 0;

function printRoutes(stack: any[], prefix = '') {
  stack.forEach((middleware: any) => {
    if (middleware.route) {
      // Routes registered directly on the app
      const methods = Object.keys(middleware.route.methods).map(m => m.toUpperCase()).join(', ');
      const path = prefix + middleware.route.path;
      console.log(`  ${methods.padEnd(10)} ${path}`);
      routeCount++;
    } else if (middleware.name === 'router' && middleware.handle.stack) {
      // Router middleware
      const routerPath = middleware.regexp.source
        .replace('\\/?', '')
        .replace('(?=\\/|$)', '')
        .replace(/\\\//g, '/')
        .replace(/\^/g, '')
        .replace(/\$/g, '')
        .replace(/\(\?:\([^)]+\)\)/g, '');
      
      printRoutes(middleware.handle.stack, prefix + routerPath);
    }
  });
}

printRoutes(app._router.stack);

console.log(`\nTotal routes found: ${routeCount}`);
console.log('\n========================================\n');
