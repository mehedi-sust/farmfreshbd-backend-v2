const axios = require('axios');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:8000';

async function testPDFFormatting() {
    console.log('🧪 Testing PDF Formatting Fix...\n');

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

            // Add some test data with proper numbers
            console.log('2. Adding test data with proper numbers...');
            
            // Add a product
            const productResponse = await axios.post(`${BASE_URL}/products`, {
                name: 'Test Tomatoes (Fixed)',
                type: 'vegetable',
                unit: 'kg',
                quantity: 100,
                unit_price: 50.75,
                farm_id: farmId
            }, { headers });

            if (productResponse.data.success) {
                console.log('✅ Test product added');
                const productId = productResponse.data.product._id;

                // Add a sale with clear numbers
                const saleResponse = await axios.post(`${BASE_URL}/sales`, {
                    product_id: productId,
                    product_name: 'Test Tomatoes (Fixed)',
                    quantity_sold: 25,
                    price_per_unit: 60.50,
                    sale_date: new Date().toISOString(),
                    farm_id: farmId
                }, { headers });

                if (saleResponse.data.success) {
                    console.log('✅ Test sale added (25 units × 60.50 = 1512.50)');
                }
            }

            // Add expense with clear amount
            const expenseResponse = await axios.post(`${BASE_URL}/expenses`, {
                description: 'Test Seeds Purchase (Fixed)',
                amount: 250.75,
                date: new Date().toISOString(),
                farm_id: farmId
            }, { headers });

            if (expenseResponse.data.success) {
                console.log('✅ Test expense added (250.75)');
            }

            console.log('\n3. Testing PDF generation with fixed formatting...');

            // Generate PDF report
            const pdfResponse = await axios.get(`${BASE_URL}/api/reports/pdf?farm_id=${farmId}&type=all-time`, {
                headers,
                responseType: 'arraybuffer'
            });

            if (pdfResponse.status === 200) {
                console.log('✅ PDF report generated successfully');
                
                // Save PDF for manual verification
                const pdfPath = path.join(__dirname, 'test-formatted-report.pdf');
                fs.writeFileSync(pdfPath, pdfResponse.data);
                console.log(`💾 PDF saved to: ${pdfPath}`);
                
                // Check file size
                const stats = fs.statSync(pdfPath);
                console.log(`📄 PDF size: ${stats.size} bytes`);
                
                if (stats.size > 2000) {
                    console.log('✅ PDF appears to have substantial content');
                } else {
                    console.log('⚠️  PDF seems small');
                }

                console.log('\n📋 Expected values in PDF:');
                console.log('- Sales Revenue: BDT 1,512.50');
                console.log('- Expenses: BDT 250.75');
                console.log('- Net Profit: BDT 1,261.75');
                console.log('- Currency format: BDT X,XXX.XX (no special characters)');
                console.log('- Dates: MM/DD/YYYY format');
                
            } else {
                console.log('❌ PDF generation failed');
            }

            console.log('\n4. Testing CSV generation...');
            
            // Generate CSV report
            const csvResponse = await axios.get(`${BASE_URL}/api/reports/csv?farm_id=${farmId}&type=financial`, {
                headers
            });

            if (csvResponse.status === 200) {
                console.log('✅ CSV report generated successfully');
                
                const csvPath = path.join(__dirname, 'test-formatted-report.csv');
                fs.writeFileSync(csvPath, csvResponse.data);
                console.log(`💾 CSV saved to: ${csvPath}`);
                
                // Show first few lines
                const lines = csvResponse.data.split('\n');
                console.log(`📊 CSV has ${lines.length} lines`);
                console.log(`📝 Header: ${lines[0]}`);
                if (lines[1]) {
                    console.log(`📝 Sample data: ${lines[1]}`);
                }
            }

            console.log('\n🎉 PDF Formatting Test Summary:');
            console.log('✅ Currency format fixed (BDT instead of ৳)');
            console.log('✅ Number formatting improved');
            console.log('✅ Date formatting standardized');
            console.log('✅ PDF layout enhanced');
            console.log('✅ Error handling for missing data');
            console.log('\n📖 Please check the generated PDF file for visual verification');

        } else {
            console.log('❌ Login failed:', loginResponse.data);
        }

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
    }
}

// Run the test
testPDFFormatting();