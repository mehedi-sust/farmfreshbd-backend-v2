const { generateToken, verifyToken } = require('./src/config/auth');

// Test token generation and verification
const userId = '507f1f77bcf86cd799439011';
const email = 'test@example.com';
const role = 'farmer';

console.log('Generating token...');
const token = generateToken(userId, email, role);
console.log('Generated token:', token);

console.log('\nVerifying token...');
const decoded = verifyToken(token);
console.log('Decoded token:', decoded);

console.log('\nToken valid?', decoded !== null);