#!/usr/bin/env node

/**
 * Serverless Functions Validation Script
 * Tests all serverless functions to ensure they work properly
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 Validating Serverless Functions Configuration...\n');

// Check if all required files exist
const requiredFiles = [
  'api/index.js',
  'src/routes/auth.js', 
  'src/routes/products.js',
  'src/routes/store_products.js',
  'src/routes/farms.js',
  'src/routes/stats.js',
  'src/routes/admin.js',
  'vercel.json',
  'package.json'
];

console.log('📁 Checking required files...');
let allFilesExist = true;

requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - MISSING`);
    allFilesExist = false;
  }
});

if (!allFilesExist) {
  console.log('\n❌ Some required files are missing!');
  process.exit(1);
}

// Test function imports
console.log('\n📦 Testing function imports...');
const apiFiles = ['index.js'];
let allImportsWork = true;

apiFiles.forEach(file => {
  try {
    require(`./api/${file}`);
    console.log(`✅ api/${file} imports successfully`);
  } catch (error) {
    console.log(`❌ api/${file} import failed: ${error.message}`);
    allImportsWork = false;
  }
});

const routeFiles = ['auth.js','products.js','store_products.js','farms.js','stats.js','admin.js'];
console.log('\n📦 Testing route module imports...');
routeFiles.forEach(file => {
  try {
    require(`./src/routes/${file}`);
    console.log(`✅ src/routes/${file} imports successfully`);
  } catch (error) {
    console.log(`❌ src/routes/${file} import failed: ${error.message}`);
    allImportsWork = false;
  }
});

// Check vercel.json configuration
console.log('\n⚙️  Validating vercel.json...');
try {
  const vercelConfig = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
  
  // Check required properties
  if (vercelConfig.version === 2) {
    console.log('✅ Version 2 configuration');
  } else {
    console.log('❌ Invalid version configuration');
    allImportsWork = false;
  }
  
  if (vercelConfig.functions) {
    console.log('✅ Functions configuration present');
  } else {
    console.log('⚠️  Functions configuration not specified (will use defaults)');
  }
  
  if (vercelConfig.routes && vercelConfig.routes.length > 0) {
    console.log('✅ Routes configuration present');
  } else {
    console.log('❌ Missing routes configuration');
    allImportsWork = false;
  }
  
} catch (error) {
  console.log(`❌ vercel.json validation failed: ${error.message}`);
  allImportsWork = false;
}

// Check package.json
console.log('\n📋 Validating package.json...');
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  
  if (packageJson.main === 'api/index.js') {
    console.log('✅ Main entry point set to api/index.js');
  } else {
    console.log('❌ Main entry point should be api/index.js');
  }
  
  if (packageJson.engines && packageJson.engines.node) {
    console.log('✅ Node.js engine specified');
  } else {
    console.log('⚠️  Node.js engine not specified (recommended for Vercel)');
  }
  
} catch (error) {
  console.log(`❌ package.json validation failed: ${error.message}`);
  allImportsWork = false;
}

// Final result
console.log('\n' + '='.repeat(50));
if (allFilesExist && allImportsWork) {
  console.log('🎉 All validations passed! Ready for Vercel deployment.');
  console.log('\nNext steps:');
  console.log('1. Set up environment variables in Vercel dashboard');
  console.log('2. Run: vercel login');
  console.log('3. Run: vercel --prod');
  process.exit(0);
} else {
  console.log('❌ Some validations failed. Please fix the issues above.');
  process.exit(1);
}