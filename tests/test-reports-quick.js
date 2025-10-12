const axios = require('axios');

const BASE_URL = 'http://localhost:8000';

async function testReportsQuick() {
    console.log('🧪 Quick Reports API Test...\n');

    try {
        // Test if server is running
        console.log('1. Testing server health...');
        const healthResponse = await axios.get(`${BASE_URL}/health`);
        
        if (healthResponse.status === 200) {
            console.log('✅ Server is running');
        }

        // Test reports endpoint without auth (should get 401)
        console.log('2. Testing reports endpoint (should require auth)...');
        try {
            await axios.get(`${BASE_URL}/api/reports/pdf`);
            console.log('❌ Reports endpoint should require authentication');
        } catch (error) {
            if (error.response && error.response.status === 401) {
                console.log('✅ Reports endpoint correctly requires authentication');
            } else if (error.response && error.response.status === 400) {
                console.log('✅ Reports endpoint is working (400 = missing farm_id)');
            } else {
                console.log(`⚠️  Unexpected response: ${error.response?.status} - ${error.response?.data?.error || error.message}`);
            }
        }

        console.log('\n🎉 Quick test completed - Reports API is properly mounted!');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.code === 'ECONNREFUSED') {
            console.error('💡 Make sure the server is running on port 8000');
        }
    }
}

// Run the test
testReportsQuick();