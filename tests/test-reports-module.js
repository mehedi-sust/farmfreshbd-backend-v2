// Test if the reports module can be loaded properly
console.log('Testing reports module loading...\n');

try {
    console.log('1. Testing individual dependencies...');
    
    // Test express
    const express = require('express');
    console.log('✅ Express loaded');
    
    // Test cors
    const cors = require('cors');
    console.log('✅ CORS loaded');
    
    // Test PDFKit
    const PDFDocument = require('pdfkit');
    console.log('✅ PDFKit loaded');
    
    // Test database config
    const { connectToDatabase, getCollections } = require('./src/config/database');
    console.log('✅ Database config loaded');
    
    // Test auth config
    const { authenticate } = require('./src/config/auth');
    console.log('✅ Auth config loaded');
    
    // Test helpers
    const { asyncHandler, toObjectId, verifyFarmAccess } = require('./src/utils/helpers');
    console.log('✅ Helpers loaded');
    
    console.log('\n2. Testing reports module...');
    
    // Test reports module
    const reportsModule = require('./api/reports');
    console.log('✅ Reports module loaded');
    console.log('Type:', typeof reportsModule);
    console.log('Constructor:', reportsModule.constructor.name);
    console.log('Is Express app:', typeof reportsModule.listen === 'function');
    
    if (typeof reportsModule.listen === 'function') {
        console.log('🎉 Reports module is a valid Express app!');
    } else {
        console.log('❌ Reports module is not a valid Express app');
        console.log('Available methods:', Object.getOwnPropertyNames(reportsModule));
    }
    
} catch (error) {
    console.error('❌ Error loading module:', error.message);
    console.error('Stack:', error.stack);
}