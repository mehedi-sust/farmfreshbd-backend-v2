const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

async function testRemoveAllData() {
    console.log('🧪 Testing Remove All Data Functionality...\n');

    try {
        // Test login first
        console.log('1. Testing login...');
        const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
            email: 'test@example.com',
            password: 'password123'
        });

        if (loginResponse.data.success) {
            console.log('✅ Login successful');
            const token = loginResponse.data.token;
            const farmId = loginResponse.data.user.farm_id;
            
            const headers = {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            };

            console.log(`📊 Farm ID: ${farmId}\n`);

            // Get current stats
            console.log('2. Getting current database stats...');
            const statsResponse = await axios.get(`${BASE_URL}/farms/${farmId}/stats`, { headers });
            
            if (statsResponse.data.success) {
                console.log('✅ Current database stats:');
                console.log(JSON.stringify(statsResponse.data.stats, null, 2));
                console.log(`📈 Total records: ${statsResponse.data.total_records}\n`);
            }

            // Test remove all data without confirmation (should fail)
            console.log('3. Testing remove all data without confirmation (should fail)...');
            try {
                await axios.delete(`${BASE_URL}/farms/${farmId}/remove-all-data`, {
                    headers,
                    data: {}
                });
                console.log('❌ Should have failed but didn\'t');
            } catch (error) {
                if (error.response && error.response.status === 400) {
                    console.log('✅ Correctly rejected without confirmation');
                    console.log(`📝 Error: ${error.response.data.error}\n`);
                } else {
                    console.log('❌ Unexpected error:', error.message);
                }
            }

            // Test remove all data with wrong confirmation (should fail)
            console.log('4. Testing remove all data with wrong confirmation (should fail)...');
            try {
                await axios.delete(`${BASE_URL}/farms/${farmId}/remove-all-data`, {
                    headers,
                    data: { confirmation: 'WRONG_CONFIRMATION' }
                });
                console.log('❌ Should have failed but didn\'t');
            } catch (error) {
                if (error.response && error.response.status === 400) {
                    console.log('✅ Correctly rejected with wrong confirmation');
                    console.log(`📝 Error: ${error.response.data.error}\n`);
                } else {
                    console.log('❌ Unexpected error:', error.message);
                }
            }

            // Test remove all data with correct confirmation (should succeed)
            console.log('5. Testing remove all data with correct confirmation...');
            const removeResponse = await axios.delete(`${BASE_URL}/farms/${farmId}/remove-all-data`, {
                headers,
                data: { confirmation: 'DELETE_ALL_DATA' }
            });

            if (removeResponse.data.success) {
                console.log('✅ Remove all data successful');
                console.log('📊 Deletion stats:');
                console.log(JSON.stringify(removeResponse.data.stats, null, 2));
                console.log(`⚠️  ${removeResponse.data.warning}\n`);
            }

            // Verify data is removed
            console.log('6. Verifying data removal...');
            const finalStatsResponse = await axios.get(`${BASE_URL}/farms/${farmId}/stats`, { headers });
            
            if (finalStatsResponse.data.success) {
                console.log('✅ Final database stats:');
                console.log(JSON.stringify(finalStatsResponse.data.stats, null, 2));
                console.log(`📈 Total records: ${finalStatsResponse.data.total_records}`);
                
                if (finalStatsResponse.data.total_records === 0) {
                    console.log('🎉 All data successfully removed!');
                } else {
                    console.log('⚠️  Some data still remains');
                }
            }

        } else {
            console.log('❌ Login failed:', loginResponse.data);
        }

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
    }
}

// Run the test
testRemoveAllData();