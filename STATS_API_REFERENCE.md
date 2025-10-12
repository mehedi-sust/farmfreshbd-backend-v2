# Stats API Reference

## Overview

The Stats API provides comprehensive farm statistics, financial data, and dashboard metrics.

## Authentication

All endpoints require authentication via Bearer token:

```
Authorization: Bearer <your_jwt_token>
```

## Endpoints

### 1. Get Farm Stats

**GET** `/stats/farm/:farm_id`

Returns complete farm statistics.

**Parameters:**
- `farm_id` (path) - Farm ID

**Response:**
```json
{
  "farm_id": "68ea502c382ae54918b1a6e4",
  "total_products": 150000.00,
  "total_expenses": 45000.00,
  "product_count": 250,
  "total_profit": 35000.00,
  "total_investments": 200000.00,
  "total_sales": 80000.00,
  "sold_product_count": 120,
  "updated_at": "2025-01-11T12:00:00.000Z"
}
```

**Fields:**
- `total_products` - Total value of all products in inventory
- `total_expenses` - Sum of all expenses
- `product_count` - Total quantity of products in inventory
- `total_profit` - Sales minus expenses
- `total_investments` - Sum of all infrastructure investments
- `total_sales` - Total revenue from sales
- `sold_product_count` - Total quantity of products sold

---

### 2. Update Stats Data

**POST** `/stats/farm/:farm_id/update_stats_data`

Recalculates and returns updated farm statistics.

**Parameters:**
- `farm_id` (path) - Farm ID

**Response:**
```json
{
  "message": "Stats updated successfully",
  "current_stats": {
    "farm_id": "68ea502c382ae54918b1a6e4",
    "total_products": 150000.00,
    "total_expenses": 45000.00,
    "product_count": 250,
    "total_profit": 35000.00,
    "total_investments": 200000.00,
    "total_sales": 80000.00,
    "sold_product_count": 120
  },
  "updated_at": "2025-01-11T12:00:00.000Z"
}
```

---

### 3. Get Monthly Financial Data

**GET** `/stats/farm/:farm_id/monthly_financial`

Returns 12 months of financial data for the current year.

**Parameters:**
- `farm_id` (path) - Farm ID

**Response:**
```json
[
  {
    "month": "Jan",
    "investments": 50000,
    "expenses": 12000,
    "productValue": 30000,
    "profit": 8000,
    "sales": 20000
  },
  {
    "month": "Feb",
    "investments": 0,
    "expenses": 15000,
    "productValue": 25000,
    "profit": 10000,
    "sales": 25000
  }
  // ... 10 more months
]
```

**Fields:**
- `month` - Month name (Jan-Dec)
- `investments` - Infrastructure investments for the month
- `expenses` - Total expenses for the month
- `productValue` - Value of products created in the month
- `profit` - Sales minus expenses for the month
- `sales` - Total sales revenue for the month

---

### 4. Get Current Year Profit

**GET** `/stats/farm/:farm_id/current_year_profit`

Returns profit trends for the current year by month.

**Parameters:**
- `farm_id` (path) - Farm ID

**Response:**
```json
[
  {
    "month": "Jan",
    "profit": 8000,
    "expenses": 12000,
    "revenue": 20000
  },
  {
    "month": "Feb",
    "profit": 10000,
    "expenses": 15000,
    "revenue": 25000
  }
  // ... 10 more months
]
```

**Fields:**
- `month` - Month name (Jan-Dec)
- `profit` - Revenue minus expenses for the month
- `expenses` - Total expenses for the month
- `revenue` - Total sales revenue for the month

---

### 5. Get Dashboard Summary

**GET** `/stats/dashboard?farm_id=:farm_id`

Returns dashboard summary with recent items and totals.

**Parameters:**
- `farm_id` (query) - Farm ID

**Response:**
```json
{
  "summary": {
    "total_products": 250,
    "total_expenses": 45000,
    "total_investments": 200000,
    "total_sales": 80000,
    "pending_orders": 5
  },
  "recent": {
    "products": [...],
    "expenses": [...],
    "sales": [...]
  },
  "pending_orders": [...]
}
```

---

## Usage Examples

### JavaScript/Axios

```javascript
const axios = require('axios');

const API_URL = 'http://localhost:8000';
const token = 'your_jwt_token';
const farmId = 'your_farm_id';

// Get farm stats
const stats = await axios.get(`${API_URL}/stats/farm/${farmId}`, {
  headers: { Authorization: `Bearer ${token}` }
});

// Update stats
const updated = await axios.post(`${API_URL}/stats/farm/${farmId}/update_stats_data`, {}, {
  headers: { Authorization: `Bearer ${token}` }
});

// Get monthly financial
const monthly = await axios.get(`${API_URL}/stats/farm/${farmId}/monthly_financial`, {
  headers: { Authorization: `Bearer ${token}` }
});

// Get current year profit
const profit = await axios.get(`${API_URL}/stats/farm/${farmId}/current_year_profit`, {
  headers: { Authorization: `Bearer ${token}` }
});
```

### cURL

```bash
# Get farm stats
curl -X GET "http://localhost:8000/stats/farm/68ea502c382ae54918b1a6e4" \
  -H "Authorization: Bearer your_jwt_token"

# Update stats
curl -X POST "http://localhost:8000/stats/farm/68ea502c382ae54918b1a6e4/update_stats_data" \
  -H "Authorization: Bearer your_jwt_token"

# Get monthly financial
curl -X GET "http://localhost:8000/stats/farm/68ea502c382ae54918b1a6e4/monthly_financial" \
  -H "Authorization: Bearer your_jwt_token"

# Get current year profit
curl -X GET "http://localhost:8000/stats/farm/68ea502c382ae54918b1a6e4/current_year_profit" \
  -H "Authorization: Bearer your_jwt_token"
```

## Error Responses

### 400 Bad Request
```json
{
  "error": "farm_id is required"
}
```

### 401 Unauthorized
```json
{
  "error": "No token provided"
}
```

### 403 Forbidden
```json
{
  "error": "You don't have access to this farm"
}
```

### 500 Internal Server Error
```json
{
  "error": "Error message details"
}
```

## Notes

- All monetary values are in the farm's local currency
- Dates are in ISO 8601 format
- Monthly data is for the current calendar year
- Stats are calculated in real-time from the database
- The `update_stats_data` endpoint doesn't actually update stored stats, it recalculates them on-demand

## Testing

Use the provided test script to verify all endpoints:

```bash
cd farmfreshbd-backend-v2
node test-stats.js
```

Or use the batch file on Windows:

```bash
test-stats.bat
```
