#!/usr/bin/env node

// Test script to demonstrate BYOK functionality
const https = require('https');

// Test configuration
const TEST_CONFIG = {
  // Replace with your actual Vercel deployment URL
  vercelUrl: 'https://your-app.vercel.app',
  // Test with a fake key to see the logic flow
  testApiKey: 'sk-test-key-12345',
  // Test content
  testContent: 'Create a presentation about artificial intelligence and its impact on software development'
};

// Function to make HTTP request
function makeRequest(url, options, data) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: body
        });
      });
    });
    
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

// Test 1: Free Tier (no API key)
async function testFreeTier() {
  console.log('🧪 Test 1: Free Tier (no API key)');
  console.log('=====================================');
  
  try {
    const response = await makeRequest(
      `${TEST_CONFIG.vercelUrl}/api/story`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      },
      {
        raw: TEST_CONFIG.testContent,
        tone: 'inspiring',
        length: 'medium',
        model: 'gpt-4o-mini'
      }
    );
    
    console.log(`Status: ${response.statusCode}`);
    console.log(`Response: ${response.body}`);
    console.log(`Rate Limit Headers:`, {
      limit: response.headers['x-ratelimit-limit'],
      remaining: response.headers['x-ratelimit-remaining'],
      reset: response.headers['x-ratelimit-reset']
    });
  } catch (error) {
    console.log(`Error: ${error.message}`);
  }
  console.log('\n');
}

// Test 2: BYOK with fake key
async function testBYOKFake() {
  console.log('🧪 Test 2: BYOK with fake key');
  console.log('==============================');
  
  try {
    const response = await makeRequest(
      `${TEST_CONFIG.vercelUrl}/api/story`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-openai-key': TEST_CONFIG.testApiKey
        }
      },
      {
        raw: TEST_CONFIG.testContent,
        tone: 'inspiring',
        length: 'medium',
        model: 'gpt-4o-mini'
      }
    );
    
    console.log(`Status: ${response.statusCode}`);
    console.log(`Response: ${response.body}`);
    console.log(`Rate Limit Headers:`, {
      limit: response.headers['x-ratelimit-limit'],
      remaining: response.headers['x-ratelimit-remaining'],
      reset: response.headers['x-ratelimit-reset']
    });
  } catch (error) {
    console.log(`Error: ${error.message}`);
  }
  console.log('\n');
}

// Test 3: BYOK with Authorization header
async function testBYOKAuth() {
  console.log('🧪 Test 3: BYOK with Authorization header');
  console.log('==========================================');
  
  try {
    const response = await makeRequest(
      `${TEST_CONFIG.vercelUrl}/api/story`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TEST_CONFIG.testApiKey}`
        }
      },
      {
        raw: TEST_CONFIG.testContent,
        tone: 'inspiring',
        length: 'medium',
        model: 'gpt-4o-mini'
      }
    );
    
    console.log(`Status: ${response.statusCode}`);
    console.log(`Response: ${response.body}`);
    console.log(`Rate Limit Headers:`, {
      limit: response.headers['x-ratelimit-limit'],
      remaining: response.headers['x-ratelimit-remaining'],
      reset: response.headers['x-ratelimit-reset']
    });
  } catch (error) {
    console.log(`Error: ${error.message}`);
  }
  console.log('\n');
}

// Test 4: Rate limiting
async function testRateLimiting() {
  console.log('🧪 Test 4: Rate Limiting (6 requests)');
  console.log('======================================');
  
  for (let i = 1; i <= 7; i++) {
    try {
      const response = await makeRequest(
        `${TEST_CONFIG.vercelUrl}/api/story`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        },
        {
          raw: `Test request ${i}`,
          tone: 'inspiring',
          length: 'medium',
          model: 'gpt-4o-mini'
        }
      );
      
      console.log(`Request ${i}: Status ${response.statusCode}, Remaining: ${response.headers['x-ratelimit-remaining']}`);
      
      if (response.statusCode === 429) {
        console.log(`✅ Rate limit hit after ${i} requests`);
        break;
      }
    } catch (error) {
      console.log(`Request ${i}: Error - ${error.message}`);
    }
  }
  console.log('\n');
}

// Main test function
async function runTests() {
  console.log('🚀 BYOK (Bring Your Own Key) Testing Suite');
  console.log('==========================================');
  console.log(`Testing against: ${TEST_CONFIG.vercelUrl}`);
  console.log('\n');
  
  // Wait a bit between tests
  await testFreeTier();
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  await testBYOKFake();
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  await testBYOKAuth();
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  await testRateLimiting();
  
  console.log('✅ All tests completed!');
  console.log('\n📋 Expected Results:');
  console.log('- Free tier: Should work with your API key, limited to 6 requests/minute');
  console.log('- BYOK fake: Should fail with invalid API key error');
  console.log('- BYOK auth: Should fail with invalid API key error');
  console.log('- Rate limiting: Should hit 429 after 6 requests');
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests, testFreeTier, testBYOKFake, testBYOKAuth, testRateLimiting };
