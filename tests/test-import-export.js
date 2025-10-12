const axios = require('axios');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3001';

async function testImportExport() {
    console.log('🧪 Testing Import/Export Functionality...\n');

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

            // Add some test data first
            console.log('2. Adding test data...');
            
            // Add a product
            const productResponse = await axios.post(`${BASE_URL}/products`, {
                name: 'Test Product for Export',
                type: 'vegetable',
                unit: 'kg',
                farm_id: farmId
            }, { headers });

            if (productResponse.data.success) {
                console.log('✅ Test product added');
            }

            // Add an expense type
            const expenseTypeResponse = await axios.post(`${BASE_URL}/expense-types`, {
                name: 'Test Expense Type',
                farm_id: farmId
            }, { headers });

            if (expenseTypeResponse.data.success) {
                console.log('✅ Test expense type added');
            }

            // Get current stats
            console.log('\n3. Getting current database stats...');
            const statsResponse = await axios.get(`${BASE_URL}/farms/${farmId}/stats`, { headers });
            
            if (statsResponse.data.success) {
                console.log('✅ Current database stats:');
                console.log(JSON.stringify(statsResponse.data.stats, null, 2));
                console.log(`📈 Total records: ${statsResponse.data.total_records}\n`);
            }

            // Test export
            console.log('4. Testing export...');
            const exportResponse = await axios.get(`${BASE_URL}/farms/${farmId}/export`, { headers });
            
            if (exportResponse.data.success) {
                console.log('✅ Export successful');
                console.log('📊 Export stats:');
                console.log(JSON.stringify(exportResponse.data.stats, null, 2));
                
                // Save export data to file
                const exportFile = path.join(__dirname, 'test-export.json');
                fs.writeFileSync(exportFile, JSON.stringify(exportResponse.data, null, 2));
                console.log(`💾 Export saved to: ${exportFile}\n`);

                // Validate export data structure
                const exportData = exportResponse.data;
                if (exportData.data && exportData.data.metadata && exportData.data.metadata.farm_id) {
                    console.log('✅ Export data structure is valid');
                    console.log(`📝 Metadata: farm_id=${exportData.data.metadata.farm_id}, version=${exportData.data.metadata.version}`);
                } else {
                    console.log('❌ Export data structure is invalid');
                    console.log('Expected: { success: true, data: { metadata: { farm_id: "...", ... }, ... } }');
                }

                // Test import with the exported data
                console.log('\n5. Testing import with exported data...');
                
                // First, clear all data
                console.log('5a. Clearing existing data...');
                const clearResponse = await axios.delete(`${BASE_URL}/farms/${farmId}/remove-all-data`, {
                    headers,
                    data: { confirmation: 'DELETE_ALL_DATA' }
                });

                if (clearResponse.data.success) {
                    console.log('✅ Data cleared successfully');
                }

                // Now import the data
                console.log('5b. Importing data...');
                const importResponse = await axios.post(`${BASE_URL}/farms/${farmId}/import`, {
                    data: exportData.data, // Send just the data part, not the wrapper
                    replace_existing: true
                }, { headers });

                if (importResponse.data.success) {
                    console.log('✅ Import successful');
                    console.log('📊 Import stats:');
                    console.log(JSON.stringify(importResponse.data.stats, null, 2));
                    console.log(`📈 Total imported: ${importResponse.data.total_imported}`);
                } else {
                    console.log('❌ Import failed:', importResponse.data);
                }

                // Verify imported data
                console.log('\n6. Verifying imported data...');
                const finalStatsResponse = await axios.get(`${BASE_URL}/farms/${farmId}/stats`, { headers });
                
                if (finalStatsResponse.data.success) {
                    console.log('✅ Final database stats:');
                    console.log(JSON.stringify(finalStatsResponse.data.stats, null, 2));
                    console.log(`📈 Total records: ${finalStatsResponse.data.total_records}`);
                    
                    // Compare with original stats
                    const originalTotal = statsResponse.data.total_records;
                    const finalTotal = finalStatsResponse.data.total_records;
                    
                    if (originalTotal === finalTotal) {
                        console.log('🎉 Import/Export test successful! Data matches.');
                    } else {
                        console.log(`⚠️  Data mismatch: Original=${originalTotal}, Final=${finalTotal}`);
                    }
                }

                // Clean up test file
                if (fs.existsSync(exportFile)) {
                    fs.unlinkSync(exportFile);
                    console.log('🗑️  Test export file cleaned up');
                }

            } else {
                console.log('❌ Export failed:', exportResponse.data);
            }

        } else {
            console.log('❌ Login failed:', loginResponse.data);
        }

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
        if (error.response?.data) {
            console.error('Response data:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

// Run the test
testImportExport();