const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

// Test data
const testUser = {
    email: 'test@example.com',
    password: 'password123',
    name: 'Test User'
};

let authToken = '';
let farmId = '';

async function testHeaderTimestamp() {
    console.log('🧪 Testing PDF Header Timestamp Fix...\n');

    try {
        // 1. Login
        console.log('1. Authenticating...');
        
        try {
            await axios.post(`${BASE_URL}/auth/register`, testUser);
        } catch (error) {
            // User might already exist
        }

        const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
            email: testUser.email,
            password: testUser.password
        });

        authToken = loginResponse.data.access_token;
        console.log('✅ Authentication successful');

        // 2. Get farm
        const farmsResponse = await axios.get(`${BASE_URL}/farms`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        
        if (farmsResponse.data.length > 0) {
            farmId = farmsResponse.data[0]._id;
            console.log('✅ Farm found:', farmId);
        } else {
            console.log('❌ No farm found. Please create a farm first.');
            return;
        }

        // 3. Test PDF generation with header timestamp
        console.log('\n2. Testing PDF Header Timestamp...');
        
        const testCases = [
            { name: 'All-Time Report', params: { farm_id: farmId, type: 'all-time' } },
            { name: 'Current Year Report', params: { farm_id: farmId, type: 'current-year' } },
            { name: 'Custom Range Report', params: { 
                farm_id: farmId, 
                start_date: '2024-01-01',
                end_date: '2024-12-31'
            }}
        ];

        for (const testCase of testCases) {
            console.log(`\n   Testing ${testCase.name}...`);
            
            try {
                const pdfResponse = await axios.get(`${BASE_URL}/reports/pdf`, {
                    params: testCase.params,
                    headers: { Authorization: `Bearer ${authToken}` },
                    responseType: 'arraybuffer'
                });

                if (pdfResponse.status === 200) {
                    console.log(`   ✅ ${testCase.name} generated successfully`);
                    console.log(`      Size: ${pdfResponse.data.byteLength} bytes`);
                    
                    // Check if PDF is valid (basic check)
                    const pdfHeader = Buffer.from(pdfResponse.data.slice(0, 4)).toString();
                    if (pdfHeader === '%PDF') {
                        console.log(`      ✅ Valid PDF format`);
                    } else {
                        console.log(`      ❌ Invalid PDF format`);
                    }
                } else {
                    console.log(`   ❌ ${testCase.name} generation failed`);
                }
            } catch (error) {
                console.log(`   ❌ ${testCase.name} error:`, error.response?.status || error.message);
            }
        }

        console.log('\n🎉 PDF Header Timestamp Test Completed!');
        console.log('\n📋 Expected Results:');
        console.log('✅ Timestamp appears in header section after "Report Period:"');
        console.log('✅ Format: "Generated at: MM/DD/YYYY, HH:MM:SS AM/PM"');
        console.log('✅ No footer text at bottom of pages');
        console.log('✅ No blank pages with timestamp at top');
        console.log('✅ All PDF reports generate without crashes');
        
        console.log('\n📝 Manual Verification Steps:');
        console.log('1. Download any generated PDF report');
        console.log('2. Open in PDF viewer');
        console.log('3. Check first page header section');
        console.log('4. Look for "Generated at: [timestamp]" after "Report Period:"');
        console.log('5. Verify no footer text at bottom of pages');
        console.log('6. Confirm no blank pages exist');

        console.log('\n📍 Header Layout Should Be:');
        console.log('   Farm Fresh BD');
        console.log('   Farm Management Dashboard');
        console.log('   ');
        console.log('   Farm Management Report');
        console.log('   [Report Type Summary]');
        console.log('   ');
        console.log('   Farm Name: [Name]');
        console.log('   Report Generated: [Date]');
        console.log('   Report Period: [Period]');
        console.log('   Generated at: [Full Timestamp] ← NEW');

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
        
        if (error.code === 'ECONNREFUSED') {
            console.log('\n💡 Make sure the backend server is running on port 3001');
            console.log('   Run: npm start or node src/index.js');
        }
    }
}

// Run the test
testHeaderTimestamp();