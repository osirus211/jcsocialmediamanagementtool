#!/usr/bin/env node

/**
 * CI Pipeline Setup Validation Script
 * 
 * This script validates that the CI pipeline for authentication validation
 * is properly configured and ready for use.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class CISetupValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.checks = [];
  }

  // Main validation function
  async validate() {
    console.log('🔧 Validating CI Pipeline Setup for Authentication Validation');
    console.log('============================================================');

    // Check workflow files
    this.validateWorkflowFiles();
    
    // Check test files
    this.validateTestFiles();
    
    // Check scripts
    this.validateScripts();
    
    // Check dependencies
    this.validateDependencies();
    
    // Check configuration
    this.validateConfiguration();
    
    // Generate report
    this.generateReport();
  }

  validateWorkflowFiles() {
    console.log('\n📋 Validating workflow files...');
    
    const requiredWorkflows = [
      '.github/workflows/auth-validation.yml',
      '.github/workflows/security-validation.yml',
      '.github/workflows/performance-validation.yml'
    ];
    
    requiredWorkflows.forEach(workflow => {
      if (fs.existsSync(workflow)) {
        this.checks.push(`✅ ${workflow} exists`);
        
        // Validate workflow syntax
        try {
          const content = fs.readFileSync(workflow, 'utf8');
          
          // Check for required sections
          const requiredSections = ['name:', 'on:', 'jobs:'];
          requiredSections.forEach(section => {
            if (content.includes(section)) {
              this.checks.push(`✅ ${workflow} contains ${section}`);
            } else {
              this.errors.push(`❌ ${workflow} missing ${section}`);
            }
          });
          
          // Check for authentication-specific content
          if (workflow.includes('auth-validation')) {
            const authSections = ['backend-security-tests', 'e2e-security-tests', 'performance-tests'];
            authSections.forEach(section => {
              if (content.includes(section)) {
                this.checks.push(`✅ ${workflow} contains ${section} job`);
              } else {
                this.warnings.push(`⚠️ ${workflow} missing ${section} job`);
              }
            });
          }
          
        } catch (error) {
          this.errors.push(`❌ Error reading ${workflow}: ${error.message}`);
        }
      } else {
        this.errors.push(`❌ Missing workflow file: ${workflow}`);
      }
    });
    
    // Check CI integration
    const ciWorkflow = '.github/workflows/ci.yml';
    if (fs.existsSync(ciWorkflow)) {
      const content = fs.readFileSync(ciWorkflow, 'utf8');
      if (content.includes('auth-validation-check')) {
        this.checks.push('✅ CI workflow integrated with auth validation');
      } else {
        this.warnings.push('⚠️ CI workflow not integrated with auth validation');
      }
    }
  }

  validateTestFiles() {
    console.log('\n🧪 Validating test files...');
    
    const requiredTestFiles = [
      'apps/backend/src/__tests__/security/comprehensive-security-validation.test.ts',
      'apps/frontend/e2e/auth/security-validation.spec.ts',
      'apps/frontend/e2e/auth/performance-validation-simple.spec.ts',
      'apps/frontend/e2e/security-test-runner.ts'
    ];
    
    requiredTestFiles.forEach(testFile => {
      if (fs.existsSync(testFile)) {
        this.checks.push(`✅ ${testFile} exists`);
        
        // Check test content
        try {
          const content = fs.readFileSync(testFile, 'utf8');
          
          if (testFile.includes('security-validation')) {
            const securityTests = ['brute force', 'timing attack', 'rate limiting', 'jwt', 'audit'];
            securityTests.forEach(test => {
              if (content.toLowerCase().includes(test)) {
                this.checks.push(`✅ ${testFile} includes ${test} tests`);
              } else {
                this.warnings.push(`⚠️ ${testFile} missing ${test} tests`);
              }
            });
          }
          
        } catch (error) {
          this.errors.push(`❌ Error reading ${testFile}: ${error.message}`);
        }
      } else {
        this.errors.push(`❌ Missing test file: ${testFile}`);
      }
    });
  }

  validateScripts() {
    console.log('\n📜 Validating scripts...');
    
    const requiredScripts = [
      '.github/scripts/ci-integration.sh',
      '.github/scripts/test-reporter.cjs',
      '.github/scripts/validate-ci-setup.cjs'
    ];
    
    requiredScripts.forEach(script => {
      if (fs.existsSync(script)) {
        this.checks.push(`✅ ${script} exists`);
        
        // Check if script is executable (on Unix systems)
        if (process.platform !== 'win32') {
          try {
            const stats = fs.statSync(script);
            if (stats.mode & parseInt('111', 8)) {
              this.checks.push(`✅ ${script} is executable`);
            } else {
              this.warnings.push(`⚠️ ${script} is not executable`);
            }
          } catch (error) {
            this.warnings.push(`⚠️ Could not check ${script} permissions`);
          }
        }
      } else {
        this.errors.push(`❌ Missing script: ${script}`);
      }
    });
  }

  validateDependencies() {
    console.log('\n📦 Validating dependencies...');
    
    // Check backend dependencies
    const backendPackage = 'apps/backend/package.json';
    if (fs.existsSync(backendPackage)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(backendPackage, 'utf8'));
        
        const requiredDeps = ['jest', 'supertest', 'bcrypt', 'jsonwebtoken'];
        requiredDeps.forEach(dep => {
          if (pkg.dependencies?.[dep] || pkg.devDependencies?.[dep]) {
            this.checks.push(`✅ Backend has ${dep} dependency`);
          } else {
            this.warnings.push(`⚠️ Backend missing ${dep} dependency`);
          }
        });
        
        // Check test script
        if (pkg.scripts?.test) {
          this.checks.push('✅ Backend has test script');
        } else {
          this.errors.push('❌ Backend missing test script');
        }
        
      } catch (error) {
        this.errors.push(`❌ Error reading backend package.json: ${error.message}`);
      }
    }
    
    // Check frontend dependencies
    const frontendPackage = 'apps/frontend/package.json';
    if (fs.existsSync(frontendPackage)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(frontendPackage, 'utf8'));
        
        const requiredDeps = ['@playwright/test', 'vitest'];
        requiredDeps.forEach(dep => {
          if (pkg.dependencies?.[dep] || pkg.devDependencies?.[dep]) {
            this.checks.push(`✅ Frontend has ${dep} dependency`);
          } else {
            this.warnings.push(`⚠️ Frontend missing ${dep} dependency`);
          }
        });
        
        // Check E2E test script
        if (pkg.scripts?.['test:e2e']) {
          this.checks.push('✅ Frontend has E2E test script');
        } else {
          this.warnings.push('⚠️ Frontend missing E2E test script');
        }
        
      } catch (error) {
        this.errors.push(`❌ Error reading frontend package.json: ${error.message}`);
      }
    }
  }

  validateConfiguration() {
    console.log('\n⚙️ Validating configuration...');
    
    // Check for environment configuration
    const envFiles = ['.env.example', 'apps/backend/.env.example', 'apps/frontend/.env.example'];
    envFiles.forEach(envFile => {
      if (fs.existsSync(envFile)) {
        this.checks.push(`✅ ${envFile} exists`);
        
        const content = fs.readFileSync(envFile, 'utf8');
        const requiredVars = ['JWT_SECRET', 'MONGODB_URI', 'REDIS_URL'];
        requiredVars.forEach(varName => {
          if (content.includes(varName)) {
            this.checks.push(`✅ ${envFile} includes ${varName}`);
          } else {
            this.warnings.push(`⚠️ ${envFile} missing ${varName}`);
          }
        });
      }
    });
    
    // Check documentation
    const docFile = 'docs/ci-pipeline-authentication-validation.md';
    if (fs.existsSync(docFile)) {
      this.checks.push('✅ CI pipeline documentation exists');
    } else {
      this.warnings.push('⚠️ CI pipeline documentation missing');
    }
  }

  generateReport() {
    console.log('\n📊 Validation Report');
    console.log('====================');
    
    const totalChecks = this.checks.length + this.warnings.length + this.errors.length;
    
    console.log(`\n✅ Passed Checks: ${this.checks.length}`);
    this.checks.forEach(check => console.log(`  ${check}`));
    
    if (this.warnings.length > 0) {
      console.log(`\n⚠️ Warnings: ${this.warnings.length}`);
      this.warnings.forEach(warning => console.log(`  ${warning}`));
    }
    
    if (this.errors.length > 0) {
      console.log(`\n❌ Errors: ${this.errors.length}`);
      this.errors.forEach(error => console.log(`  ${error}`));
    }
    
    console.log(`\n📈 Summary: ${this.checks.length}/${totalChecks} checks passed`);
    
    if (this.errors.length === 0) {
      console.log('\n🎉 CI Pipeline setup validation completed successfully!');
      console.log('The authentication validation pipeline is ready for use.');
      return true;
    } else {
      console.log('\n❌ CI Pipeline setup validation failed!');
      console.log('Please address the errors above before using the pipeline.');
      return false;
    }
  }
}

// Main execution
async function main() {
  const validator = new CISetupValidator();
  
  try {
    const success = await validator.validate();
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { CISetupValidator };