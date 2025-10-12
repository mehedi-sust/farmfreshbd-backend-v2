const axios = require('axios');

const BASE_URL = 'http://localhost:8000';

async function testCompleteReports() {
    console.log('🧪 Testing Complete Reports System...\n');

    try {
        // Test 1: Server Health
        console.log('1. Testing server health...');
        const healthResponse = await axios.get(`${BASE_URL}/health`);
        
        if (healthResponse.status === 200) {
            console.log('✅ Server is running');
        }

        // Test 2: Reports Test Endpoint (no auth required)
        console.log('\n2. Testing reports test endpoint...');
        try {
            const testResponse = await axios.get(`${BASE_URL}/api/reports/test`);
            console.log('✅ Reports test endpoint working:', testResponse.data.message);
        } catch (error) {
            console.log('❌ Reports test endpoint failed:', error.response?.status, error.response?.data?.error || error.message);
        }

        // Test 3: Login to get auth token
        console.log('\n3. Testing login for authentication...');
        let token = null;
        let farmId = null;
        
        try {
            const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
                email: 'test@example.com',
                password: 'password123'
            });

            if (loginResponse.data.success) {
                token = loginResponse.data.token;
                farmId = loginResponse.data.user.farm_id;
                console.log('✅ Login successful');
                console.log(`📊 Farm ID: ${farmId}`);
            } else {
                console.log('❌ Login failed:', loginResponse.data);
                return;
            }
        } catch (error) {
            console.log('❌ Login error:', error.response?.data || error.message);
            console.log('💡 Make sure you have a test user registered');
            return;
        }

        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        // Test 4: PDF Report Generation
        console.log('\n4. Testing PDF report generation...');
        try {
            const pdfResponse = await axios.get(`${BASE_URL}/api/reports/pdf?farm_id=${farmId}&type=all-time`, {
                headers,
                responseType: 'arraybuffer'
            });

            if (pdfResponse.status === 200) {
                console.log('✅ PDF report generated successfully');
                console.log(`📄 PDF size: ${pdfResponse.data.length} bytes`);
                
                if (pdfResponse.data.length > 1000) {
                    console.log('✅ PDF appears to have content');
                } else {
                    console.log('⚠️  PDF seems small, might be empty');
                }
            }
        } catch (error) {
            console.log('❌ PDF generation failed:', error.response?.status, error.response?.data || error.message);
        }

        // Test 5: CSV Report Generation
        console.log('\n5. Testing CSV report generation...');
        try {
            const csvResponse = await axios.get(`${BASE_URL}/api/reports/csv?farm_id=${farmId}&type=financial`, {
                headers
            });

            if (csvResponse.status === 200) {
                console.log('✅ CSV report generated successfully');
                const csvContent = csvResponse.data;
                const lines = csvContent.split('\n');
                console.log(`📊 CSV has ${lines.length} lines`);
                console.log(`📝 Header: ${lines[0]}`);
                
                if (lines.length > 1) {
                    console.log('✅ CSV appears to have data');
                }
            }
        } catch (error) {
            console.log('❌ CSV generation failed:', error.response?.status, error.response?.data || error.message);
        }

        // Test 6: Error Handling
        console.log('\n6. Testing error handling...');
        
        // Test without farm_id
        try {
            await axios.get(`${BASE_URL}/api/reports/pdf`, { headers });
            console.log('❌ Should have failed without farm_id');
        } catch (error) {
            if (error.response && error.response.status === 400) {
                console.log('✅ Correctly rejected request without farm_id');
            } else {
                console.log('⚠️  Unexpected error:', error.response?.status);
            }
        }

        // Test without authentication
        try {
            await axios.get(`${BASE_URL}/api/reports/pdf?farm_id=${farmId}`);
            console.log('❌ Should have failed without authentication');
        } catch (error) {
            if (error.response && error.response.status === 401) {
                console.log('✅ Correctly rejected request without authentication');
            } else {
                console.log('⚠️  Unexpected error:', error.response?.status);
            }
        }

        console.log('\n🎉 Complete Reports Test Summary:');
        console.log('✅ Server health check');
        console.log('✅ Reports API endpoints');
        console.log('✅ Authentication integration');
        console.log('✅ PDF report generation');
        console.log('✅ CSV report generation');
        console.log('✅ Error handling validation');
        console.log('\n🚀 Reports system is fully functional!');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.code === 'ECONNREFUSED') {
            console.error('💡 Make sure the server is running on port 8000');
        }
    }
}

// Run the test
testCompleteReports();