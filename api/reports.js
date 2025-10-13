const express = require('express');
const { connectToDatabase, getCollections } = require('../src/config/database');
const { authenticate } = require('../src/config/auth');
const { asyncHandler, serializeDoc, serializeDocs, toObjectId, verifyFarmAccess } = require('../src/utils/helpers');

const router = express.Router();

// Generate PDF report - GET /reports/pdf
router.get('/pdf', authenticate, asyncHandler(async (req, res) => {
  const { farm_id, type, start_date, end_date } = req.query;

  if (!farm_id) {
    return res.status(400).json({ error: 'farm_id is required' });
  }

  const { db } = await connectToDatabase();
  await verifyFarmAccess(farm_id, req.user.userId, db);

  // For now, return a simple response indicating PDF generation
  // In a real implementation, you would use a PDF library like puppeteer or jsPDF
  res.setHeader('Content-Type', 'application/json');
  res.json({
    message: 'PDF report generation requested',
    farm_id,
    type: type || 'all-data',
    start_date,
    end_date,
    status: 'success',
    note: 'PDF generation functionality needs to be implemented with a PDF library'
  });
}));

// Generate CSV report - GET /reports/csv
router.get('/csv', authenticate, asyncHandler(async (req, res) => {
  const { farm_id, type, start_date, end_date } = req.query;

  if (!farm_id) {
    return res.status(400).json({ error: 'farm_id is required' });
  }

  const { db } = await connectToDatabase();
  await verifyFarmAccess(farm_id, req.user.userId, db);

  const { sales, expenses, investments, products, product_batches } = await getCollections(db);

  let data = [];
  let filename = 'report.csv';
  let headers = [];

  const query = { farm_id: toObjectId(farm_id) };
  
  // Add date range filter if provided
  if (start_date || end_date) {
    query.date = {};
    if (start_date) query.date.$gte = new Date(start_date);
    if (end_date) query.date.$lte = new Date(end_date);
  }

  try {
    switch (type) {
      case 'sales':
        data = await sales.find(query).sort({ date: -1 }).toArray();
        headers = ['Date', 'Product Name', 'Quantity', 'Price Per Unit', 'Total Amount', 'Customer Name', 'Status'];
        filename = 'sales_report.csv';
        break;
      
      case 'expenses':
        data = await expenses.find(query).sort({ date: -1 }).toArray();
        headers = ['Date', 'Type', 'Description', 'Amount', 'Product Batch'];
        filename = 'expenses_report.csv';
        break;
      
      case 'investments':
        data = await investments.find(query).sort({ date: -1 }).toArray();
        headers = ['Date', 'Type', 'Description', 'Amount'];
        filename = 'investments_report.csv';
        break;
      
      case 'all-data':
      default:
        // Get all data types
        const [salesData, expensesData, investmentsData] = await Promise.all([
          sales.find(query).sort({ date: -1 }).toArray(),
          expenses.find(query).sort({ date: -1 }).toArray(),
          investments.find(query).sort({ date: -1 }).toArray()
        ]);
        
        // Combine all data with type indicators
        data = [
          ...salesData.map(item => ({ ...item, data_type: 'sale' })),
          ...expensesData.map(item => ({ ...item, data_type: 'expense' })),
          ...investmentsData.map(item => ({ ...item, data_type: 'investment' }))
        ].sort((a, b) => new Date(b.date) - new Date(a.date));
        
        headers = ['Date', 'Type', 'Description', 'Amount', 'Data Type'];
        filename = 'all_data_report.csv';
        break;
    }

    // Generate CSV content
    let csvContent = headers.join(',') + '\n';
    
    data.forEach(item => {
      const row = [];
      switch (type) {
        case 'sales':
          row.push(
            item.date ? new Date(item.date).toLocaleDateString() : '',
            item.product_name || '',
            item.quantity || '',
            item.price_per_unit || '',
            item.total_amount || '',
            item.customer_name || '',
            item.status || ''
          );
          break;
        
        case 'expenses':
          row.push(
            item.date ? new Date(item.date).toLocaleDateString() : '',
            item.type || '',
            item.description || '',
            item.amount || '',
            item.product_batch || ''
          );
          break;
        
        case 'investments':
          row.push(
            item.date ? new Date(item.date).toLocaleDateString() : '',
            item.type || '',
            item.description || '',
            item.amount || ''
          );
          break;
        
        case 'all-data':
        default:
          row.push(
            item.date ? new Date(item.date).toLocaleDateString() : '',
            item.type || item.product_name || '',
            item.description || '',
            item.amount || item.total_amount || '',
            item.data_type || ''
          );
          break;
      }
      
      // Escape commas and quotes in CSV
      const escapedRow = row.map(field => {
        const str = String(field || '');
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
      });
      
      csvContent += escapedRow.join(',') + '\n';
    });

    // Set headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);

  } catch (error) {
    console.error('Error generating CSV report:', error);
    res.status(500).json({ error: 'Failed to generate CSV report', message: error.message });
  }
}));

module.exports = router;