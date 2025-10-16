const DatabaseService = require('./src/services/database.service');

(async () => {
  try {
    console.log('🔍 Checking for store product with ID: dc27a36e-cc9b-4ed9-a860-071dbbdbc36e');
    const product = await DatabaseService.getStoreProductById('dc27a36e-cc9b-4ed9-a860-071dbbdbc36e');
    
    if (product) {
      console.log('✅ Found product:', JSON.stringify(product, null, 2));
    } else {
      console.log('❌ Product not found');
      
      // Let's check what store products exist
      console.log('\n🔍 Checking all store products...');
      const allProducts = await DatabaseService.getStoreProducts({});
      console.log('📦 Total store products found:', allProducts.length);
      
      if (allProducts.length > 0) {
        console.log('📋 First few store products:');
        allProducts.slice(0, 3).forEach((p, i) => {
          console.log(`  ${i+1}. ID: ${p._id}, Name: ${p.product_name}`);
        });
      }
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  process.exit(0);
})();