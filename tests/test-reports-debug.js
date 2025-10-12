// Debug the reports module loading with detailed error catching
console.log('Starting detailed reports module debug...\n');

try {
    // Wrap the require in a try-catch to see if there are any errors
    console.log('Attempting to require reports module...');
    
    // Use eval to catch any syntax errors
    const fs = require('fs');
    const reportsCode = fs.readFileSync('./api/reports.js', 'utf8');
    
    console.log('File read successfully, length:', reportsCode.length);
    
    // Check for common issues
    if (!reportsCode.includes('module.exports')) {
        console.log('❌ No module.exports found');
    } else {
        console.log('✅ module.exports found');
    }
    
    if (!reportsCode.includes('const app = express()')) {
        console.log('❌ No Express app creation found');
    } else {
        console.log('✅ Express app creation found');
    }
    
    // Try to require it
    const reportsModule = require('./api/reports');
    console.log('Module loaded, type:', typeof reportsModule);
    
} catch (error) {
    console.error('❌ Error during module loading:');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
}