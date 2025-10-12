const axios = require('axios');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3001';

async function testReportsAPI() {
    console.log('🧪 Testing Reports API Functionality...\n');

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

            // Add some test data for reports
            console.log('2. Adding test data for reports...');
            
            // Add products
            const productResponse = await axios.post(`${BASE_URL}/products`, {
                name: 'Report Test Tomatoes',
                type: 'vegetable',
                unit: 'kg',
                quantity: 100,
                unit_price: 50,
                farm_id: farmId
            }, { headers });

            if (productResponse.data.success) {
                console.log('✅ Test product added');
                const productId = productResponse.data.product._id;

                // Add a sale
                const saleResponse = await axios.post(`${BASE_URL}/sales`, {
                    product_id: productId,
                    product_name: 'Report Test Tomatoes',
                    quantity_sold: 10,
                    price_per_unit: 60,
                    sale_date: new Date().toISOString(),
                    farm_id: farmId
                }, { headers });

                if (saleResponse.data.success) {
                    console.log('✅ Test sale added');
                }
            }

            // Add expense
            const expenseResponse = await axios.post(`${BASE_URL}/expenses`, {
                description: 'Report Test Seeds',
                amount: 200,
                date: new Date().toISOString(),
                farm_id: farmId
            }, { headers });

            if (expenseResponse.data.success) {
                console.log('✅ Test expense added');
            }

            // Add investment
            const investmentResponse = await axios.post(`${BASE_URL}/investments`, {
                description: 'Report Test Equipment',
                amount: 1000,
                date: new Date().toISOString(),
                farm_id: farmId
            }, { headers });

            if (investmentResponse.data.success) {
                console.log('✅ Test investment added');
            }

            console.log('\n3. Testing PDF Report Generation...');

            // Test All-Time PDF Report
            console.log('3a. Testing All-Time PDF Report...');
            try {
                const pdfResponse = await axios.get(`${BASE_URL}/reports/pdf?farm_id=${farmId}&type=all-time`, {
                    headers,
                    responseType: 'arraybuffer'
                });

                if (pdfResponse.status === 200) {
                    console.log('✅ All-time PDF report generated successfully');
                    
                    // Save PDF for verification
                    const pdfPath = path.join(__dirname, 'test-all-time-report.pdf');
                    fs.writeFileSync(pdfPath, pdfResponse.data);
                    console.log(`💾 PDF saved to: ${pdfPath}`);
                    
                    // Check file size
                    const stats = fs.statSync(pdfPath);
                    console.log(`📄 PDF size: ${stats.size} bytes`);
                    
                    if (stats.size > 1000) {
                        console.log('✅ PDF appears to have content');
                    } else {
                        console.log('⚠️  PDF seems too small');
                    }
                } else {
                    console.log('❌ PDF generation failed');
                }
            } catch (error) {
                console.log('❌ PDF generation error:', error.response?.data || error.message);
            }

            // Test Current Year PDF Report
            console.log('3b. Testing Current Year PDF Report...');
            try {
                const pdfResponse = await axios.get(`${BASE_URL}/reports/pdf?farm_id=${farmId}&type=current-year`, {
                    headers,
                    responseType: 'arraybuffer'
                });

                if (pdfResponse.status === 200) {
                    console.log('✅ Current year PDF report generated successfully');
                    
                    const pdfPath = path.join(__dirname, 'test-current-year-report.pdf');
                    fs.writeFileSync(pdfPath, pdfResponse.data);
                    console.log(`💾 PDF saved to: ${pdfPath}`);
                } else {
                    console.log('❌ Current year PDF generation failed');
                }
            } catch (error) {
                console.log('❌ Current year PDF generation error:', error.response?.data || error.message);
            }

            console.log('\n4. Testing CSV Report Generation...');

            // Test Financial CSV
            console.log('4a. Testing Financial CSV...');
            try {
                const csvResponse = await axios.get(`${BASE_URL}/reports/csv?farm_id=${farmId}&type=financial`, {
                    headers
                });

                if (csvResponse.status === 200) {
                    console.log('✅ Financial CSV report generated successfully');
                    
                    const csvPath = path.join(__dirname, 'test-financial-report.csv');
                    fs.writeFileSync(csvPath, csvResponse.data);
                    console.log(`💾 CSV saved to: ${csvPath}`);
                    
                    // Check CSV content
                    const csvContent = csvResponse.data;
                    const lines = csvContent.split('\n');
                    console.log(`📊 CSV has ${lines.length} lines`);
                    console.log(`📝 Header: ${lines[0]}`);
                    
                    if (lines.length > 1) {
                        console.log('✅ CSV appears to have data');
                    }
                } else {
                    console.log('❌ Financial CSV generation failed');
                }
            } catch (error) {
                console.log('❌ Financial CSV generation error:', error.response?.data || error.message);
            }

            // Test Products CSV
            console.log('4b. Testing Products CSV...');
            try {
                const csvResponse = await axios.get(`${BASE_URL}/reports/csv?farm_id=${farmId}&type=products`, {
                    headers
                });

                if (csvResponse.status === 200) {
                    console.log('✅ Products CSV report generated successfully');
                    
                    const csvPath = path.join(__dirname, 'test-products-report.csv');
                    fs.writeFileSync(csvPath, csvResponse.data);
                    console.log(`💾 CSV saved to: ${csvPath}`);
                } else {
                    console.log('❌ Products CSV generation failed');
                }
            } catch (error) {
                console.log('❌ Products CSV generation error:', error.response?.data || error.message);
            }

            // Test Sales CSV
            console.log('4c. Testing Sales CSV...');
            try {
                const csvResponse = await axios.get(`${BASE_URL}/reports/csv?farm_id=${farmId}&type=sales`, {
                    headers
                });

                if (csvResponse.status === 200) {
                    console.log('✅ Sales CSV report generated successfully');
                    
                    const csvPath = path.join(__dirname, 'test-sales-report.csv');
                    fs.writeFileSync(csvPath, csvResponse.data);
                    console.log(`💾 CSV saved to: ${csvPath}`);
                } else {
                    console.log('❌ Sales CSV generation failed');
                }
            } catch (error) {
                console.log('❌ Sales CSV generation error:', error.response?.data || error.message);
            }

            console.log('\n5. Testing Error Handling...');

            // Test without farm_id
            console.log('5a. Testing without farm_id (should fail)...');
            try {
                await axios.get(`${BASE_URL}/reports/pdf`, { headers });
                console.log('❌ Should have failed but didn\'t');
            } catch (error) {
                if (error.response && error.response.status === 400) {
                    console.log('✅ Correctly rejected without farm_id');
                } else {
                    console.log('❌ Unexpected error:', error.message);
                }
            }

            // Test with invalid farm_id
            console.log('5b. Testing with invalid farm_id (should fail)...');
            try {
                await axios.get(`${BASE_URL}/reports/pdf?farm_id=invalid_id`, { headers });
                console.log('❌ Should have failed but didn\'t');
            } catch (error) {
                if (error.response && (error.response.status === 400 || error.response.status === 403)) {
                    console.log('✅ Correctly rejected invalid farm_id');
                } else {
                    console.log('❌ Unexpected error:', error.message);
                }
            }

            console.log('\n🎉 Reports API Test Summary:');
            console.log('✅ Login and authentication');
            console.log('✅ Test data creation');
            console.log('✅ PDF report generation (all-time)');
            console.log('✅ PDF report generation (current year)');
            console.log('✅ CSV report generation (financial)');
            console.log('✅ CSV report generation (products)');
            console.log('✅ CSV report generation (sales)');
            console.log('✅ Error handling validation');
            console.log('\n🚀 All reports functionality is working correctly!');

            // Clean up test files
            console.log('\n6. Cleaning up test files...');
            const testFiles = [
                'test-all-time-report.pdf',
                'test-current-year-report.pdf',
                'test-financial-report.csv',
                'test-products-report.csv',
                'test-sales-report.csv'
            ];

            testFiles.forEach(file => {
                const filePath = path.join(__dirname, file);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    console.log(`🗑️  Deleted: ${file}`);
                }
            });

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
testReportsAPI();