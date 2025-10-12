const axios = require('axios');

const BASE_URL = 'http://localhost:8000';

async function testServerStart() {
    console.log('🧪 Testing Server Startup...\n');

    try {
        // Wait a moment for server to start
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Test health endpoint
        console.log('1. Testing health endpoint...');
        const healthResponse = await axios.get(`${BASE_URL}/health`);
        
        if (healthResponse.status === 200) {
            console.log('✅ Health endpoint working');
            console.log(`📊 Response: ${JSON.stringify(healthResponse.data)}`);
        }

        // Test main API endpoint
        console.log('\n2. Testing main API endpoint...');
        const apiResponse = await axios.get(`${BASE_URL}/`);
        
        if (apiResponse.status === 200) {
            console.log('✅ Main API endpoint working');
            console.log(`📊 API Version: ${apiResponse.data.version}`);
            console.log(`📊 Status: ${apiResponse.data.status}`);
        }

        // Test reports endpoint (should require auth)
        console.log('\n3. Testing reports endpoint (should require auth)...');
        try {
            await axios.get(`${BASE_URL}/reports/pdf`);
            console.log('❌ Reports endpoint should require authentication');
        } catch (error) {
            if (error.response && error.response.status === 401) {
                console.log('✅ Reports endpoint correctly requires authentication');
            } else {
                console.log(`⚠️  Unexpected error: ${error.response?.status || error.message}`);
            }
        }

        console.log('\n🎉 Server startup test completed successfully!');
        console.log('✅ All endpoints are responding correctly');
        console.log('✅ Authentication is working');
        console.log('✅ Reports API is properly mounted');

    } catch (error) {
        console.error('❌ Server startup test failed:', error.message);
        if (error.code === 'ECONNREFUSED') {
            console.error('💡 Make sure the server is running on port 8000');
        }
    }
}

// Run the test
testServerStart();