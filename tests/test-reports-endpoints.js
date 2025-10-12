const axios = require('axios');

const BASE_URL = 'http://localhost:8000';

async function testReportsEndpoints() {
    console.log('🧪 Testing Reports Endpoints...\n');

    try {
        // Test different endpoint paths
        const endpoints = [
            '/api/reports/test',
            '/reports/test',
            '/api/reports/pdf',
            '/reports/pdf'
        ];

        for (const endpoint of endpoints) {
            console.log(`Testing: ${endpoint}`);
            try {
                const response = await axios.get(`${BASE_URL}${endpoint}`);
                console.log(`✅ ${endpoint}: ${response.status} - ${JSON.stringify(response.data)}`);
            } catch (error) {
                if (error.response) {
                    console.log(`⚠️  ${endpoint}: ${error.response.status} - ${error.response.data?.error || error.response.data?.message || 'Unknown error'}`);
                } else {
                    console.log(`❌ ${endpoint}: ${error.message}`);
                }
            }
        }

        console.log('\n📊 Endpoint test completed');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the test
testReportsEndpoints();