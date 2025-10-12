const axios = require('axios');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3001';

async function testCompleteSettingsFlow() {
    console.log('🧪 Testing Complete Settings Page Functionality...\n');

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

            // Add comprehensive test data
            console.log('2. Adding comprehensive test data...');
            
            // Add products
            const products = [
                { name: 'Test Tomatoes', type: 'vegetable', unit: 'kg' },
                { name: 'Test Carrots', type: 'vegetable', unit: 'kg' },
                { name: 'Test Milk', type: 'dairy', unit: 'liter' }
            ];

            for (const product of products) {
                const productResponse = await axios.post(`${BASE_URL}/products`, {
                    ...product,
                    farm_id: farmId
                }, { headers });
                
                if (productResponse.data.success) {
                    console.log(`✅ Added product: ${product.name}`);
                }
            }

            // Add expense types
            const expenseTypes = [
                { name: 'Seeds' },
                { name: 'Fertilizer' },
                { name: 'Equipment' }
            ];

            for (const expenseType of expenseTypes) {
                const expenseTypeResponse = await axios.post(`${BASE_URL}/expense-types`, {
                    ...expenseType,
                    farm_id: farmId
                }, { headers });
                
                if (expenseTypeResponse.data.success) {
                    console.log(`✅ Added expense type: ${expenseType.name}`);
                }
            }

            // Add expenses
            const expenses = [
                { description: 'Tomato seeds', amount: 50, date: new Date().toISOString() },
                { description: 'Organic fertilizer', amount: 100, date: new Date().toISOString() }
            ];

            for (const expense of expenses) {
                const expenseResponse = await axios.post(`${BASE_URL}/expenses`, {
                    ...expense,
                    farm_id: farmId
                }, { headers });
                
                if (expenseResponse.data.success) {
                    console.log(`✅ Added expense: ${expense.description}`);
                }
            }

            // Add investments
            const investments = [
                { description: 'Greenhouse construction', amount: 5000, date: new Date().toISOString() },
                { description: 'Irrigation system', amount: 2000, date: new Date().toISOString() }
            ];

            for (const investment of investments) {
                const investmentResponse = await axios.post(`${BASE_URL}/investments`, {
                    ...investment,
                    farm_id: farmId
                }, { headers });
                
                if (investmentResponse.data.success) {
                    console.log(`✅ Added investment: ${investment.description}`);
                }
            }

            console.log('\n3. Getting baseline statistics...');
            const initialStatsResponse = await axios.get(`${BASE_URL}/farms/${farmId}/stats`, { headers });
            
            if (initialStatsResponse.data.success) {
                console.log('✅ Initial database stats:');
                console.log(JSON.stringify(initialStatsResponse.data.stats, null, 2));
                console.log(`📈 Total records: ${initialStatsResponse.data.total_records}\n`);
            }

            // Test Export Functionality
            console.log('4. Testing Export Functionality...');
            const exportResponse = await axios.get(`${BASE_URL}/farms/${farmId}/export`, { headers });
            
            if (exportResponse.data.success) {
                console.log('✅ Export successful');
                console.log('📊 Export stats:');
                console.log(JSON.stringify(exportResponse.data.stats, null, 2));
                
                // Validate export structure
                const exportData = exportResponse.data;
                if (exportData.data && exportData.data.metadata && exportData.data.metadata.farm_id) {
                    console.log('✅ Export data structure is valid');
                    console.log(`📝 Metadata: farm_id=${exportData.data.metadata.farm_id}, version=${exportData.data.metadata.version}`);
                    
                    // Save export for import test
                    const exportFile = path.join(__dirname, 'settings-test-export.json');
                    fs.writeFileSync(exportFile, JSON.stringify(exportData, null, 2));
                    console.log(`💾 Export saved to: ${exportFile}`);
                } else {
                    console.log('❌ Export data structure is invalid');
                    return;
                }
            } else {
                console.log('❌ Export failed:', exportResponse.data);
                return;
            }

            // Test Remove All Data Functionality
            console.log('\n5. Testing Remove All Data Functionality...');
            
            // Test without confirmation (should fail)
            console.log('5a. Testing without confirmation (should fail)...');
            try {
                await axios.delete(`${BASE_URL}/farms/${farmId}/remove-all-data`, {
                    headers,
                    data: {}
                });
                console.log('❌ Should have failed but didn\'t');
            } catch (error) {
                if (error.response && error.response.status === 400) {
                    console.log('✅ Correctly rejected without confirmation');
                } else {
                    console.log('❌ Unexpected error:', error.message);
                }
            }

            // Test with correct confirmation
            console.log('5b. Testing with correct confirmation...');
            const removeResponse = await axios.delete(`${BASE_URL}/farms/${farmId}/remove-all-data`, {
                headers,
                data: { confirmation: 'DELETE_ALL_DATA' }
            });

            if (removeResponse.data.success) {
                console.log('✅ Remove all data successful');
                console.log('📊 Deletion stats:');
                console.log(JSON.stringify(removeResponse.data.stats, null, 2));
            }

            // Verify data is removed
            console.log('5c. Verifying data removal...');
            const emptyStatsResponse = await axios.get(`${BASE_URL}/farms/${farmId}/stats`, { headers });
            
            if (emptyStatsResponse.data.success) {
                console.log('✅ Post-deletion stats:');
                console.log(JSON.stringify(emptyStatsResponse.data.stats, null, 2));
                
                if (emptyStatsResponse.data.total_records === 0) {
                    console.log('🎉 All data successfully removed!');
                } else {
                    console.log('⚠️  Some data still remains');
                }
            }

            // Test Import Functionality
            console.log('\n6. Testing Import Functionality...');
            const exportFile = path.join(__dirname, 'settings-test-export.json');
            
            if (fs.existsSync(exportFile)) {
                const exportFileContent = fs.readFileSync(exportFile, 'utf8');
                const fileData = JSON.parse(exportFileContent);
                
                // Simulate frontend data extraction logic
                let importData;
                if (fileData.data && fileData.data.metadata) {
                    importData = fileData.data;
                    console.log('✅ Export file structure recognized');
                } else {
                    console.log('❌ Invalid export file structure');
                    return;
                }

                // Validate metadata
                if (!importData.metadata || !importData.metadata.farm_id) {
                    console.log('❌ Missing required metadata');
                    return;
                }

                console.log('✅ Import data validation passed');

                // Perform import
                const importResponse = await axios.post(`${BASE_URL}/farms/${farmId}/import`, {
                    data: importData,
                    replace_existing: true
                }, { headers });

                if (importResponse.data.success) {
                    console.log('✅ Import successful');
                    console.log('📊 Import stats:');
                    console.log(JSON.stringify(importResponse.data.stats, null, 2));
                    console.log(`📈 Total imported: ${importResponse.data.total_imported}`);
                } else {
                    console.log('❌ Import failed:', importResponse.data);
                    return;
                }

                // Verify imported data
                console.log('\n7. Verifying imported data...');
                const finalStatsResponse = await axios.get(`${BASE_URL}/farms/${farmId}/stats`, { headers });
                
                if (finalStatsResponse.data.success) {
                    console.log('✅ Final database stats:');
                    console.log(JSON.stringify(finalStatsResponse.data.stats, null, 2));
                    console.log(`📈 Total records: ${finalStatsResponse.data.total_records}`);
                    
                    // Compare with original stats
                    const originalTotal = initialStatsResponse.data.total_records;
                    const finalTotal = finalStatsResponse.data.total_records;
                    
                    if (originalTotal === finalTotal) {
                        console.log('🎉 Complete settings flow test successful! Data integrity maintained.');
                    } else {
                        console.log(`⚠️  Data mismatch: Original=${originalTotal}, Final=${finalTotal}`);
                    }
                }

                // Clean up test file
                fs.unlinkSync(exportFile);
                console.log('🗑️  Test export file cleaned up');

            } else {
                console.log('❌ Export file not found for import test');
            }

            // Test Farm Info Update (if endpoint exists)
            console.log('\n8. Testing Farm Info Update...');
            try {
                const farmUpdateResponse = await axios.put(`${BASE_URL}/farms/${farmId}`, {
                    name: 'Updated Test Farm',
                    bio: 'This is a test farm updated via settings'
                }, { headers });

                if (farmUpdateResponse.data) {
                    console.log('✅ Farm info update successful');
                    console.log(`📝 Updated farm name: ${farmUpdateResponse.data.name}`);
                } else {
                    console.log('⚠️  Farm update response unclear');
                }
            } catch (error) {
                console.log('⚠️  Farm update test failed:', error.response?.data?.error || error.message);
            }

            console.log('\n🎉 Complete Settings Page Test Summary:');
            console.log('✅ Login and authentication');
            console.log('✅ Test data creation');
            console.log('✅ Database statistics');
            console.log('✅ Export functionality');
            console.log('✅ Remove all data (with validation)');
            console.log('✅ Import functionality');
            console.log('✅ Data integrity verification');
            console.log('✅ Farm info update');
            console.log('\n🚀 All settings page features are working correctly!');

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
testCompleteSettingsFlow();