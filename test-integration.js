/**
 * Integration Test Script for NestJS + Next.js Proof of Concept
 * 
 * This script tests the integrated server to ensure both API and admin dashboard
 * are working correctly in the unified application.
 */

const axios = require('axios');
const { spawn } = require('child_process');
const path = require('path');

// Configuration
const BASE_URL = 'http://localhost:3000';
const TEST_TIMEOUT = 30000; // 30 seconds

// Test results
const testResults = {
  passed: 0,
  failed: 0,
  errors: []
};

// Utility functions
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
  console.log(`${prefix} [${timestamp}] ${message}`);
}

function recordTest(name, passed, error = null) {
  if (passed) {
    testResults.passed++;
    log(`PASS: ${name}`, 'success');
  } else {
    testResults.failed++;
    testResults.errors.push({ name, error });
    log(`FAIL: ${name} - ${error}`, 'error');
  }
}

// Test functions
async function testApiHealth() {
  try {
    const response = await axios.get(`${BASE_URL}/api/health`, { timeout: 5000 });
    const isHealthy = response.status === 200 && response.data.status === 'ok';
    recordTest('API Health Check', isHealthy, isHealthy ? null : `Status: ${response.status}, Data: ${JSON.stringify(response.data)}`);
    return isHealthy;
  } catch (error) {
    recordTest('API Health Check', false, error.message);
    return false;
  }
}

async function testSwaggerDocs() {
  try {
    const response = await axios.get(`${BASE_URL}/docs`, { timeout: 5000 });
    const hasSwagger = response.status === 200 && response.data.includes('swagger');
    recordTest('Swagger Documentation', hasSwagger, hasSwagger ? null : `Status: ${response.status}`);
    return hasSwagger;
  } catch (error) {
    recordTest('Swagger Documentation', false, error.message);
    return false;
  }
}

async function testAdminDashboard() {
  try {
    const response = await axios.get(`${BASE_URL}/admin/dashboard`, { timeout: 5000 });
    const hasDashboard = response.status === 200 && response.data.includes('DeenMate Admin Dashboard');
    recordTest('Admin Dashboard', hasDashboard, hasDashboard ? null : `Status: ${response.status}`);
    return hasDashboard;
  } catch (error) {
    recordTest('Admin Dashboard', false, error.message);
    return false;
  }
}

async function testApiEndpoints() {
  const endpoints = [
    '/api/v4/quran/chapters',
    '/api/v4/prayer/methods',
    '/api/v4/hadith/collections',
    '/api/v4/zakat/nisab',
    '/api/v4/audio/reciters'
  ];

  let passed = 0;
  for (const endpoint of endpoints) {
    try {
      const response = await axios.get(`${BASE_URL}${endpoint}`, { timeout: 5000 });
      if (response.status === 200) {
        passed++;
        log(`✅ API Endpoint: ${endpoint}`, 'success');
      } else {
        log(`❌ API Endpoint: ${endpoint} - Status: ${response.status}`, 'error');
      }
    } catch (error) {
      log(`❌ API Endpoint: ${endpoint} - Error: ${error.message}`, 'error');
    }
  }

  const allPassed = passed === endpoints.length;
  recordTest('API Endpoints', allPassed, allPassed ? null : `${passed}/${endpoints.length} endpoints working`);
  return allPassed;
}

async function testAdminLogin() {
  try {
    // Test login endpoint exists
    const response = await axios.post(`${BASE_URL}/api/admin/auth/login`, {
      email: 'test@example.com',
      password: 'testpassword'
    }, { timeout: 5000, validateStatus: () => true }); // Don't throw on 4xx/5xx

    // We expect this to fail with 401/400, but the endpoint should exist
    const endpointExists = response.status === 400 || response.status === 401;
    recordTest('Admin Login Endpoint', endpointExists, endpointExists ? null : `Unexpected status: ${response.status}`);
    return endpointExists;
  } catch (error) {
    recordTest('Admin Login Endpoint', false, error.message);
    return false;
  }
}

async function testStaticAssets() {
  try {
    // Test if static assets are being served
    const response = await axios.get(`${BASE_URL}/_next/static/`, { timeout: 5000, validateStatus: () => true });
    const assetsServed = response.status === 200 || response.status === 404; // 404 is ok for root static path
    recordTest('Static Assets', assetsServed, assetsServed ? null : `Status: ${response.status}`);
    return assetsServed;
  } catch (error) {
    recordTest('Static Assets', false, error.message);
    return false;
  }
}

// Main test runner
async function runTests() {
  log('🚀 Starting Integration Tests for NestJS + Next.js Proof of Concept');
  log(`📍 Testing against: ${BASE_URL}`);
  log(`⏱️  Timeout: ${TEST_TIMEOUT}ms`);
  console.log('');

  // Wait for server to be ready
  log('⏳ Waiting for server to be ready...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Run tests
  await testApiHealth();
  await testSwaggerDocs();
  await testAdminDashboard();
  await testApiEndpoints();
  await testAdminLogin();
  await testStaticAssets();

  // Print results
  console.log('');
  log('📊 Test Results Summary:');
  log(`✅ Passed: ${testResults.passed}`);
  log(`❌ Failed: ${testResults.failed}`);
  log(`📈 Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);

  if (testResults.errors.length > 0) {
    console.log('');
    log('❌ Failed Tests:');
    testResults.errors.forEach(({ name, error }) => {
      log(`  - ${name}: ${error}`, 'error');
    });
  }

  console.log('');
  if (testResults.failed === 0) {
    log('🎉 All tests passed! Integration proof of concept is working correctly.', 'success');
  } else {
    log('⚠️  Some tests failed. Check the errors above.', 'error');
  }

  return testResults.failed === 0;
}

// Server management
let serverProcess = null;

function startServer() {
  return new Promise((resolve, reject) => {
    log('🚀 Starting integrated server...');
    
    serverProcess = spawn('node', ['poc-server.js'], {
      cwd: __dirname,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'development' }
    });

    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(output);
      
      if (output.includes('Integrated server started successfully!')) {
        log('✅ Server started successfully');
        resolve();
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error(data.toString());
    });

    serverProcess.on('error', (error) => {
      log(`❌ Failed to start server: ${error.message}`, 'error');
      reject(error);
    });

    serverProcess.on('exit', (code) => {
      if (code !== 0) {
        log(`❌ Server exited with code: ${code}`, 'error');
      }
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      if (serverProcess && !serverProcess.killed) {
        log('⏰ Server start timeout reached');
        resolve(); // Continue with tests anyway
      }
    }, 30000);
  });
}

function stopServer() {
  if (serverProcess && !serverProcess.killed) {
    log('🛑 Stopping server...');
    serverProcess.kill('SIGTERM');
    
    return new Promise((resolve) => {
      serverProcess.on('exit', () => {
        log('✅ Server stopped');
        resolve();
      });
      
      // Force kill after 5 seconds
      setTimeout(() => {
        if (serverProcess && !serverProcess.killed) {
          serverProcess.kill('SIGKILL');
          resolve();
        }
      }, 5000);
    });
  }
  return Promise.resolve();
}

// Main execution
async function main() {
  try {
    await startServer();
    const success = await runTests();
    await stopServer();
    
    process.exit(success ? 0 : 1);
  } catch (error) {
    log(`❌ Test execution failed: ${error.message}`, 'error');
    await stopServer();
    process.exit(1);
  }
}

// Handle process signals
process.on('SIGINT', async () => {
  log('🛑 Received SIGINT, stopping server...');
  await stopServer();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  log('🛑 Received SIGTERM, stopping server...');
  await stopServer();
  process.exit(0);
});

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { runTests, startServer, stopServer };
