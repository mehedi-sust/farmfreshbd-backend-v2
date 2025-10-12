const axios = require('axios');

async function checkOrderData() {
  try {
    const loginResponse = await axios.post('http://localhost:8000/api/auth/login', {
      email: 'test@example.com',
      password: 'password123'
    });
    
    const token = loginResponse.data.token;
    const ordersResponse = await axios.get('http://localhost:8000/orders/my-orders', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    console.log('Sample order data:');
    if (ordersResponse.data.length > 0) {
      console.log(JSON.stringify(ordersResponse.data[0], null, 2));
    } else {
      console.log('No orders found');
    }
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

checkOrderData();