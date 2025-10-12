const express = require('express');
const cors = require('cors');
const PDFDocument = require('pdfkit');
const { connectToDatabase, getCollections } = require('../src/config/database');
const { authenticate } = require('../src/config/auth');
const { asyncHandler, toObjectId, verifyFarmAccess } = require('../src/utils/helpers');

const app = express();
app.use(cors());
app.use(express.json());

// Helper functions
const formatCurrency = (amount) => {
  const num = parseFloat(amount || 0);
  return `BDT ${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (date) => {
  if (!date) return '';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    
    // Format as YYYY-MM-DD for CSV compatibility (no quotes, short format)
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (error) {
    return '';
  }
};

const generateCSV = (headers, rows) => {
  const csvHeaders = headers.join(',');
  const csvRows = rows.map(row => 
    row.map(cell => {
      const cellStr = String(cell || '');
      if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
        return `"${cellStr.replace(/"/g, '""')}"`;
      }
      return cellStr;
    }).join(',')
  );
  return [csvHeaders, ...csvRows].join('\n');
};

// Test endpoint
app.get('/test', (req, res) => {
  res.json({ message: 'Reports API is working', timestamp: new Date().toISOString() });
});

// PDF Report endpoint
app.get('/pdf', authenticate, asyncHandler(async (req, res) => {
  const { farm_id, type = 'all-time', start_date, end_date } = req.query;

  if (!farm_id) {
    return res.status(400).json({ error: 'farm_id is required' });
  }

  const { db } = await connectToDatabase();
  await verifyFarmAccess(farm_id, req.user.userId, db);

  const { farms, products, sales, expenses, investments } = getCollections(db);
  const farmIdObj = toObjectId(farm_id);

  try {
    const farm = await farms.findOne({ _id: farmIdObj });
    if (!farm) {
      return res.status(404).json({ error: 'Farm not found' });
    }

    // Set date range
    let startDate, endDate;
    if (start_date && end_date) {
      // Custom date range
      startDate = new Date(start_date);
      endDate = new Date(end_date);
    } else if (type === 'current-year') {
      startDate = new Date(new Date().getFullYear(), 0, 1);
      endDate = new Date();
    } else {
      startDate = new Date('2020-01-01');
      endDate = new Date();
    }

    // Fetch data
    const [farmProducts, farmSales, farmExpenses, farmInvestments] = await Promise.all([
      products.find({ farm_id: farmIdObj }).toArray(),
      sales.find({ 
        farm_id: farmIdObj,
        sale_date: { $gte: startDate, $lte: endDate }
      }).toArray(),
      expenses.find({ 
        farm_id: farmIdObj,
        date: { $gte: startDate, $lte: endDate }
      }).toArray(),
      investments.find({ 
        farm_id: farmIdObj,
        date: { $gte: startDate, $lte: endDate }
      }).toArray()
    ]);

    // Calculate totals with proper number handling
    const totalSales = farmSales.reduce((sum, sale) => {
      const quantity = parseFloat(sale.quantity_sold || 0);
      const price = parseFloat(sale.price_per_unit || 0);
      return sum + (quantity * price);
    }, 0);
    
    const totalExpenses = farmExpenses.reduce((sum, expense) => {
      return sum + parseFloat(expense.amount || 0);
    }, 0);
    
    const totalInvestments = farmInvestments.reduce((sum, investment) => {
      return sum + parseFloat(investment.amount || 0);
    }, 0);
    
    const totalProfit = totalSales - totalExpenses;

    // Create PDF with better formatting
    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    const dateRange = start_date && end_date ? `${start_date}_to_${end_date}` : type;
    res.setHeader('Content-Disposition', `attachment; filename="farm-report-${dateRange}-${new Date().toISOString().split('T')[0]}.pdf"`);
    
    doc.pipe(res);

    // Header with FarmFresh BD Branding
    doc.fontSize(28).font('Helvetica-Bold').fillColor('#2E7D32').text('Farm Fresh BD', 50, 30);
    doc.fontSize(12).font('Helvetica').fillColor('#666666').text('Farm Management Dashboard', 50, 65);
    
    // Reset color for main content
    doc.fillColor('black');
    
    // Main title
    doc.fontSize(22).font('Helvetica-Bold').text('Farm Management Report', 50, 90);
    let reportTitle = 'All Time Summary';
    if (start_date && end_date) {
      reportTitle = `Custom Range: ${formatDate(start_date)} to ${formatDate(end_date)}`;
    } else if (type === 'current-year') {
      reportTitle = 'Current Year Summary';
    }
    doc.fontSize(16).font('Helvetica').text(reportTitle, 50, 115);
    
    // Farm info
    doc.fontSize(11).text(`Farm Name: ${farm.name || 'N/A'}`, 50, 145);
    doc.text(`Report Generated: ${formatDate(new Date())}`, 50, 160);
    let reportPeriod = 'All Time';
    if (start_date && end_date) {
      reportPeriod = `${formatDate(start_date)} to ${formatDate(end_date)}`;
    } else if (type === 'current-year') {
      reportPeriod = new Date().getFullYear() + ' (Year to Date)';
    }
    doc.text(`Report Period: ${reportPeriod}`, 50, 175);
    doc.text(`Generated at: ${new Date().toLocaleString()}`, 50, 190);

    // Add a line separator
    doc.moveTo(50, 210).lineTo(550, 210).stroke();

    let yPos = 230;
    
    // Executive Summary
    doc.fontSize(16).font('Helvetica-Bold').text('Executive Summary', 50, yPos);
    yPos += 30;
    
    doc.fontSize(12).font('Helvetica');
    doc.text(`Total Sales Revenue:`, 70, yPos);
    doc.text(`${formatCurrency(totalSales)}`, 250, yPos);
    yPos += 20;
    
    doc.text(`Total Expenses:`, 70, yPos);
    doc.text(`${formatCurrency(totalExpenses)}`, 250, yPos);
    yPos += 20;
    
    doc.text(`Total Investments:`, 70, yPos);
    doc.text(`${formatCurrency(totalInvestments)}`, 250, yPos);
    yPos += 20;
    
    doc.text(`Net Profit:`, 70, yPos);
    doc.font('Helvetica-Bold').text(`${formatCurrency(totalProfit)}`, 250, yPos);
    doc.font('Helvetica');
    yPos += 20;
    
    doc.text(`Total Products:`, 70, yPos);
    doc.text(`${farmProducts.length}`, 250, yPos);
    yPos += 40;

    // Helper function to draw table with proper pagination
    const drawTable = (title, headers, rows, startY) => {
      let currentY = startY;
      
      // Check if we need a new page for the title and header
      if (currentY > 720) {
        doc.addPage();
        currentY = 50;
      }
      
      // Title
      doc.fontSize(14).font('Helvetica-Bold').text(title, 50, currentY);
      currentY += 25;
      
      if (rows.length === 0) {
        doc.fontSize(10).font('Helvetica').text('No data available for this period.', 70, currentY);
        return currentY + 20;
      }
      
      // Table setup
      const tableLeft = 50;
      const tableWidth = 500;
      const colWidths = headers.map(() => tableWidth / headers.length);
      const rowHeight = 20;
      
      // Function to draw table header
      const drawHeader = (y) => {
        doc.fontSize(9).font('Helvetica-Bold');
        let currentX = tableLeft;
        headers.forEach((header, i) => {
          doc.rect(currentX, y, colWidths[i], rowHeight).stroke();
          doc.text(header, currentX + 5, y + 5, { width: colWidths[i] - 10, align: 'left' });
          currentX += colWidths[i];
        });
        return y + rowHeight;
      };
      
      // Draw initial header
      currentY = drawHeader(currentY);
      
      // Draw rows with pagination
      doc.fontSize(8).font('Helvetica');
      const maxRowsPerPage = Math.min(rows.length, 10); // Limit to 10 rows total
      
      for (let rowIndex = 0; rowIndex < maxRowsPerPage; rowIndex++) {
        const row = rows[rowIndex];
        
        // Check if we need a new page for this row
        if (currentY > 750) {
          doc.addPage();
          currentY = 50;
          // Redraw header on new page
          doc.fontSize(14).font('Helvetica-Bold').text(`${title} (continued)`, 50, currentY);
          currentY += 25;
          currentY = drawHeader(currentY);
          doc.fontSize(8).font('Helvetica');
        }
        
        let currentX = tableLeft;
        row.forEach((cell, i) => {
          doc.rect(currentX, currentY, colWidths[i], rowHeight).stroke();
          doc.text(String(cell || ''), currentX + 5, currentY + 5, { 
            width: colWidths[i] - 10, 
            align: i === headers.length - 1 ? 'right' : 'left' // Right align last column (amounts)
          });
          currentX += colWidths[i];
        });
        currentY += rowHeight;
      }
      
      // Show count if more records exist
      if (rows.length > 10) {
        currentY += 5;
        doc.fontSize(8).font('Helvetica-Oblique').text(`... and ${rows.length - 10} more records`, tableLeft, currentY);
        currentY += 15;
      }
      
      return currentY + 20;
    };

    // Sales Transactions Table
    if (farmSales.length > 0) {
      const salesHeaders = ['Date', 'Product', 'Qty', 'Unit Price', 'Total Amount'];
      const salesRows = farmSales.map(sale => {
        const saleAmount = parseFloat(sale.quantity_sold || 0) * parseFloat(sale.price_per_unit || 0);
        return [
          formatDate(sale.sale_date),
          sale.product_name || 'Unknown Product',
          `${sale.quantity_sold || 0} units`,
          formatCurrency(sale.price_per_unit || 0),
          formatCurrency(saleAmount)
        ];
      });
      
      yPos = drawTable('Sales Transactions', salesHeaders, salesRows, yPos);
    }

    // Expenses Table
    if (farmExpenses.length > 0) {
      const expenseHeaders = ['Date', 'Description', 'Category', 'Amount'];
      const expenseRows = farmExpenses.map(expense => [
        formatDate(expense.date),
        expense.description || 'No description',
        expense.category || 'General',
        formatCurrency(expense.amount || 0)
      ]);
      
      yPos = drawTable('Expenses', expenseHeaders, expenseRows, yPos);
    }

    // Investments Table
    if (farmInvestments.length > 0) {
      const investmentHeaders = ['Date', 'Description', 'Type', 'Amount'];
      const investmentRows = farmInvestments.map(investment => [
        formatDate(investment.date),
        investment.description || 'No description',
        investment.investment_type || 'Capital Investment',
        formatCurrency(investment.amount || 0)
      ]);
      
      yPos = drawTable('Investments', investmentHeaders, investmentRows, yPos);
    }

    // Financial Summary Table
    yPos += 20;
    
    // Check if we need a new page for the summary (need space for title + 5 rows + performance indicators)
    if (yPos > 650) {
      doc.addPage();
      yPos = 50;
    }
    
    doc.fontSize(14).font('Helvetica-Bold').text('Financial Summary', 50, yPos);
    yPos += 25;
    
    const summaryData = [
      ['Total Sales Revenue', formatCurrency(totalSales)],
      ['Total Expenses', formatCurrency(totalExpenses)],
      ['Total Investments', formatCurrency(totalInvestments)],
      ['Net Profit (Sales - Expenses)', formatCurrency(totalProfit)],
      ['ROI (Profit / Investment)', totalInvestments > 0 ? `${((totalProfit / totalInvestments) * 100).toFixed(2)}%` : 'N/A']
    ];
    
    const summaryTableLeft = 50;
    const summaryTableWidth = 400;
    const summaryRowHeight = 25;
    
    summaryData.forEach((row, index) => {
      const isNetProfitRow = index === summaryData.length - 2; // Net Profit row
      
      // Check for page break within summary table
      if (yPos > 750) {
        doc.addPage();
        yPos = 50;
        doc.fontSize(14).font('Helvetica-Bold').text('Financial Summary (continued)', 50, yPos);
        yPos += 25;
      }
      
      // Draw row background for Net Profit
      if (isNetProfitRow) {
        doc.rect(summaryTableLeft, yPos, summaryTableWidth, summaryRowHeight).fillAndStroke('#f0f0f0', '#000000');
      } else {
        doc.rect(summaryTableLeft, yPos, summaryTableWidth, summaryRowHeight).stroke();
      }
      
      // Draw vertical line to separate columns
      doc.moveTo(summaryTableLeft + 250, yPos).lineTo(summaryTableLeft + 250, yPos + summaryRowHeight).stroke();
      
      // Add text
      const font = isNetProfitRow ? 'Helvetica-Bold' : 'Helvetica';
      const fontSize = isNetProfitRow ? 11 : 10;
      
      doc.fontSize(fontSize).font(font);
      doc.fillColor('black').text(row[0], summaryTableLeft + 10, yPos + 7);
      doc.text(row[1], summaryTableLeft + 260, yPos + 7, { align: 'right', width: 130 });
      
      yPos += summaryRowHeight;
    });

    // Add performance indicators
    yPos += 20;
    
    // Check if we need a new page for performance indicators
    if (yPos > 720) {
      doc.addPage();
      yPos = 50;
    }
    
    doc.fontSize(12).font('Helvetica-Bold').text('Performance Indicators', 50, yPos);
    yPos += 20;
    
    doc.fontSize(10).font('Helvetica');
    const profitMargin = totalSales > 0 ? ((totalProfit / totalSales) * 100).toFixed(2) : '0.00';
    const avgSaleValue = farmSales.length > 0 ? (totalSales / farmSales.length).toFixed(2) : '0.00';
    
    doc.text(`• Profit Margin: ${profitMargin}%`, 70, yPos);
    yPos += 15;
    doc.text(`• Average Sale Value: ${formatCurrency(avgSaleValue)}`, 70, yPos);
    yPos += 15;
    doc.text(`• Total Transactions: ${farmSales.length} sales, ${farmExpenses.length} expenses, ${farmInvestments.length} investments`, 70, yPos);
    yPos += 15;
    
    // Add additional metrics
    const expenseRatio = totalSales > 0 ? ((totalExpenses / totalSales) * 100).toFixed(2) : '0.00';
    doc.text(`• Expense Ratio: ${expenseRatio}%`, 70, yPos);
    yPos += 15;
    
    if (farmInvestments.length > 0) {
      const avgInvestment = (totalInvestments / farmInvestments.length).toFixed(2);
      doc.text(`• Average Investment: ${formatCurrency(avgInvestment)}`, 70, yPos);
      yPos += 15;
    }

    // End document
    doc.end();

  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ error: 'Failed to generate PDF report', details: error.message });
  }
}));

// CSV Report endpoint
app.get('/csv', authenticate, asyncHandler(async (req, res) => {
  const { farm_id, type = 'financial', start_date, end_date } = req.query;

  if (!farm_id) {
    return res.status(400).json({ error: 'farm_id is required' });
  }

  const { db } = await connectToDatabase();
  await verifyFarmAccess(farm_id, req.user.userId, db);

  const { products, sales, expenses, investments } = getCollections(db);
  const farmIdObj = toObjectId(farm_id);

  try {
    let csvContent = '';
    let filename = '';

    // Build date filter if provided
    let dateFilter = {};
    if (start_date || end_date) {
      if (start_date) dateFilter.$gte = new Date(start_date);
      if (end_date) dateFilter.$lte = new Date(end_date);
    }

    if (type === 'financial') {
      // Build queries with date filters
      const salesQuery = { farm_id: farmIdObj };
      const expensesQuery = { farm_id: farmIdObj };
      const investmentsQuery = { farm_id: farmIdObj };

      if (Object.keys(dateFilter).length > 0) {
        salesQuery.sale_date = dateFilter;
        expensesQuery.date = dateFilter;
        investmentsQuery.date = dateFilter;
      }

      const [farmSales, farmExpenses, farmInvestments] = await Promise.all([
        sales.find(salesQuery).toArray(),
        expenses.find(expensesQuery).toArray(),
        investments.find(investmentsQuery).toArray()
      ]);

      const headers = ['Date', 'Type', 'Description', 'Amount', 'Category'];
      const rows = [];

      farmSales.forEach(sale => {
        const saleAmount = parseFloat(sale.quantity_sold || 0) * parseFloat(sale.price_per_unit || 0);
        rows.push([
          formatDate(sale.sale_date),
          'Income',
          `Sale: ${sale.product_name || 'Unknown Product'} (${sale.quantity_sold || 0} units)`,
          saleAmount.toFixed(2),
          'Sales Revenue'
        ]);
      });

      farmExpenses.forEach(expense => {
        rows.push([
          formatDate(expense.date),
          'Expense',
          expense.description || 'No description',
          parseFloat(expense.amount || 0).toFixed(2),
          expense.category || 'General'
        ]);
      });

      farmInvestments.forEach(investment => {
        rows.push([
          formatDate(investment.date),
          'Investment',
          investment.description || 'No description',
          parseFloat(investment.amount || 0).toFixed(2),
          investment.investment_type || 'Capital Investment'
        ]);
      });

      // Sort by date
      rows.sort((a, b) => {
        const dateA = new Date(a[0]);
        const dateB = new Date(b[0]);
        return dateA - dateB;
      });

      csvContent = generateCSV(headers, rows);
      const dateRange = start_date && end_date ? `${start_date}_to_${end_date}` : 'all-time';
      filename = `farm-financial-analysis-${dateRange}-${new Date().toISOString().split('T')[0]}.csv`;

    } else if (type === 'products') {
      const productsQuery = { farm_id: farmIdObj };
      if (Object.keys(dateFilter).length > 0) {
        productsQuery.created_at = dateFilter;
      }

      const farmProducts = await products.find(productsQuery).toArray();
      
      const headers = ['Product Name', 'Type', 'Quantity', 'Unit Price', 'Total Value', 'Status', 'Created Date'];
      const rows = farmProducts.map(product => [
        product.name || 'Unknown Product',
        product.type || 'Unknown Type',
        product.quantity || 0,
        parseFloat(product.unit_price || 0).toFixed(2),
        (parseFloat(product.quantity || 0) * parseFloat(product.unit_price || 0)).toFixed(2),
        product.status || 'Active',
        formatDate(product.created_at)
      ]);

      csvContent = generateCSV(headers, rows);
      const dateRange = start_date && end_date ? `${start_date}_to_${end_date}` : 'all-time';
      filename = `farm-products-analysis-${dateRange}-${new Date().toISOString().split('T')[0]}.csv`;

    } else if (type === 'sales') {
      const salesQuery = { farm_id: farmIdObj };
      if (Object.keys(dateFilter).length > 0) {
        salesQuery.sale_date = dateFilter;
      }

      const farmSales = await sales.find(salesQuery).toArray();
      
      const headers = ['Sale Date', 'Product Name', 'Quantity Sold', 'Price Per Unit', 'Total Revenue', 'Profit'];
      const rows = farmSales.map(sale => [
        formatDate(sale.sale_date),
        sale.product_name || 'Unknown Product',
        sale.quantity_sold || 0,
        parseFloat(sale.price_per_unit || 0).toFixed(2),
        (parseFloat(sale.quantity_sold || 0) * parseFloat(sale.price_per_unit || 0)).toFixed(2),
        parseFloat(sale.profit || 0).toFixed(2)
      ]);

      csvContent = generateCSV(headers, rows);
      const dateRange = start_date && end_date ? `${start_date}_to_${end_date}` : 'all-time';
      filename = `farm-sales-analysis-${dateRange}-${new Date().toISOString().split('T')[0]}.csv`;

    } else if (type === 'all-data') {
      // Handle all data export with proper data separation
      const [farmProducts, farmSales, farmExpenses, farmInvestments] = await Promise.all([
        products.find({ farm_id: farmIdObj }).toArray(),
        sales.find({ farm_id: farmIdObj }).toArray(),
        expenses.find({ farm_id: farmIdObj }).toArray(),
        investments.find({ farm_id: farmIdObj }).toArray()
      ]);

      let allDataCSV = '';
      
      // Products section
      allDataCSV += 'PRODUCTS\n';
      allDataCSV += 'Name,Type,Quantity,Unit Price,Total Value,Status,Product Batch,Created Date\n';
      farmProducts.forEach(product => {
        const totalValue = (parseFloat(product.quantity || 0) * parseFloat(product.unit_price || 0)).toFixed(2);
        allDataCSV += `"${product.name || 'Unknown'}","${product.type || 'Unknown'}",${product.quantity || 0},${parseFloat(product.unit_price || 0).toFixed(2)},${totalValue},"${product.status || 'Active'}","${product.product_batch || 'N/A'}","${formatDate(product.created_at)}"\n`;
      });
      
      allDataCSV += '\n\nSALES\n';
      allDataCSV += 'Product Name,Quantity Sold,Price Per Unit,Total Revenue,Sale Date,Profit\n';
      farmSales.forEach(sale => {
        const totalRevenue = (parseFloat(sale.quantity_sold || 0) * parseFloat(sale.price_per_unit || 0)).toFixed(2);
        allDataCSV += `"${sale.product_name || 'Unknown'}",${sale.quantity_sold || 0},${parseFloat(sale.price_per_unit || 0).toFixed(2)},${totalRevenue},"${formatDate(sale.sale_date)}",${parseFloat(sale.profit || 0).toFixed(2)}\n`;
      });
      
      allDataCSV += '\n\nEXPENSES\n';
      allDataCSV += 'Description,Amount,Category,Date,Product Batch\n';
      farmExpenses.forEach(expense => {
        allDataCSV += `"${expense.description || 'No description'}",${parseFloat(expense.amount || 0).toFixed(2)},"${expense.category || 'General'}","${formatDate(expense.date)}","${expense.product_batch || 'N/A'}"\n`;
      });
      
      allDataCSV += '\n\nINVESTMENTS\n';
      allDataCSV += 'Description,Amount,Investment Type,Date\n';
      farmInvestments.forEach(investment => {
        allDataCSV += `"${investment.description || 'No description'}",${parseFloat(investment.amount || 0).toFixed(2)},"${investment.investment_type || 'Capital Investment'}","${formatDate(investment.date)}"\n`;
      });

      csvContent = allDataCSV;
      filename = `farm-all-data-export-${new Date().toISOString().split('T')[0]}.csv`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);

  } catch (error) {
    console.error('CSV generation error:', error);
    res.status(500).json({ error: 'Failed to generate CSV report', details: error.message });
  }
}));

module.exports = app;