const express = require('express');
const PDFDocument = require('pdfkit');
const { authenticate } = require('../config/auth');
const { asyncHandler, isValidUUID } = require('../utils/helpers');
const DatabaseService = require('../services/database.service');

const router = express.Router();

// FarmFresh BD Logo SVG (simple green farm icon)
const FARMFRESH_LOGO_SVG = `
<svg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
  <circle cx="30" cy="30" r="28" fill="#22c55e" stroke="#16a34a" stroke-width="2"/>
  <path d="M15 35 L30 20 L45 35 L40 35 L40 45 L20 45 L20 35 Z" fill="white"/>
  <rect x="25" y="25" width="10" height="20" fill="#16a34a"/>
  <circle cx="22" cy="30" r="2" fill="#fbbf24"/>
  <circle cx="38" cy="30" r="2" fill="#fbbf24"/>
  <path d="M20 15 Q25 10 30 15 Q35 10 40 15" stroke="#16a34a" stroke-width="2" fill="none"/>
</svg>`;

// Helper function to format currency
const formatCurrency = (amount) => {
  return `BDT ${Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Helper function to format date
const formatDate = (date) => {
  if (!date) return 'N/A';
  const d = new Date(date);
  return d.toLocaleDateString('en-BD', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
};

 

// Helper to truncate long strings with middle ellipsis (works well for UUIDs/emails)
const truncateMiddle = (str, max = 24) => {
  if (!str) return 'N/A';
  const s = String(str);
  if (s.length <= max) return s;
  const half = Math.floor((max - 3) / 2);
  return s.slice(0, half) + '...' + s.slice(-half);
};

// Helper to cap text length without wrapping
const safeText = (str, max = 32) => {
  if (!str) return 'N/A';
  const s = String(str).replace(/\s+/g, ' ').trim();
  return s.length <= max ? s : s.slice(0, max - 3) + '...';
};

function resolveDateRange({ type = 'all-time', start_date, end_date }) {
  let startDate, endDate;
  if (start_date && end_date) {
    startDate = new Date(start_date);
    endDate = new Date(end_date);
  } else if (type === 'current-year') {
    const now = new Date();
    startDate = new Date(now.getFullYear(), 0, 1);
    endDate = now;
  } else {
    startDate = new Date('2020-01-01');
    endDate = new Date();
  }
  return { startDate, endDate };
}

// Simple test endpoint
router.get('/test', (req, res) => {
  res.json({ message: 'Reports API is working', timestamp: new Date().toISOString() });
});

// Generate PDF report
router.get('/pdf', authenticate, asyncHandler(async (req, res) => {
  const { farm_id, type = 'all-time', start_date, end_date } = req.query;

  if (!farm_id || !isValidUUID(farm_id)) {
    return res.status(400).json({ error: 'Valid farm_id is required' });
  }

  const hasAccess = await DatabaseService.verifyFarmOwnership(farm_id, req.user.userId);
  if (!hasAccess) {
    return res.status(403).json({ error: 'Access denied to this farm' });
  }

  const { startDate, endDate: endDateResolved } = resolveDateRange({ type, start_date, end_date });

  // Get farm details and all data
  const farm = await DatabaseService.getFarmById(farm_id);
  const stats = await DatabaseService.getFarmStats(farm_id);
  const sales = await DatabaseService.getSalesByFarmWithFilters(farm_id, { start_date: startDate, end_date: endDateResolved });
  const expenses = await DatabaseService.getExpensesByFarmWithFilters(farm_id, { start_date: startDate, end_date: endDateResolved });
  const products = await DatabaseService.getProductsByFarmId(farm_id);
  const storeProducts = await DatabaseService.getStoreProductsByFarmId(farm_id);
  const investments = await DatabaseService.getInvestmentsByFarm(farm_id);
  const ordersData = await DatabaseService.getFarmOrders(farm_id, { limit: 50 });

  const filename = `${farm?.name || 'farm'}-report-${new Date().toISOString().slice(0,10)}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  doc.pipe(res);

  // Header with logo and title
  doc.fontSize(24).fillColor('#16a34a').text('FarmFresh BD', 70, 50);
  doc.fontSize(18).fillColor('#000').text('Farm Report', 70, 80);
  
  // Farm details section
  doc.fontSize(14).fillColor('#374151').text('Farm Information', 70, 120);
  doc.moveTo(70, 140).lineTo(540, 140).stroke('#e5e7eb');
  
  const farmY = 150;
  doc.fontSize(11).fillColor('#000');
  // Use bounded widths and truncation to prevent overlap/wrapping
  doc.text(`Farm Name: ${safeText(farm?.name, 28)}`, 70, farmY, { width: 220 });
  doc.text(`Farm ID: ${truncateMiddle(farm_id, 28)}`, 300, farmY, { width: 220 });
  doc.text(`Farm Type: ${safeText(farm?.type, 20)}`, 70, farmY + 15, { width: 220 });
  doc.text(`Report Generated: ${formatDate(new Date())}`, 300, farmY + 15, { width: 220 });
  doc.text(`Address: ${safeText(farm?.address, 40)}`, 70, farmY + 30, { width: 220 });
  doc.text(`Location: ${safeText(farm?.location, 40)}`, 300, farmY + 30, { width: 220 });
  doc.text(`Date Range: ${formatDate(startDate)} to ${formatDate(endDateResolved)}`, 70, farmY + 45, { width: 470 });

  // Generated by timestamp
  doc.fontSize(10).fillColor('#16a34a').text(
    `Generated by FarmFresh BD on ${new Date().toLocaleString('en-US', { 
      year: 'numeric', month: '2-digit', day: '2-digit', 
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true 
    })}`, 
    70, farmY + 70, 
    { align: 'center', width: 470 }
  );

  // Key Metrics section (renamed to Farm Stats)
  const metricsY = farmY + 100;
  doc.fontSize(14).fillColor('#374151').text('Farm Stats', 70, metricsY);
  doc.moveTo(70, metricsY + 20).lineTo(540, metricsY + 20).stroke('#e5e7eb');
  
  const roiPercent = Number(stats?.roi ?? 0).toFixed(2);
  doc.fontSize(11).fillColor('#000');
  
  // Create a nice table for metrics
  const metrics = [
    ['Total Sales Revenue', formatCurrency(stats?.total_sales)],
    ['Total Expenses', formatCurrency(stats?.total_expenses)],
    ['Total Investments', formatCurrency(stats?.total_investments)],
    ['Gross Profit', formatCurrency(stats?.gross_profit)],
    ['ROI Percentage', `${roiPercent}%`],
    ['Total Products', `${stats?.product_count ?? 0}`],
    ['Products Sold', `${stats?.sold_product_count ?? 0}`]
  ];

  let currentY = metricsY + 35;
  metrics.forEach(([label, value], index) => {
    if (index % 2 === 0) {
      doc.rect(70, currentY - 5, 470, 20).fillAndStroke('#f9fafb', '#e5e7eb');
    }
    doc.fillColor('#000').text(label, 80, currentY);
    doc.text(value, 350, currentY);
    currentY += 20;
  });

  // Products section
  currentY += 20;
  doc.fontSize(14).fillColor('#374151').text('Products', 70, currentY);
  doc.moveTo(70, currentY + 20).lineTo(540, currentY + 20).stroke('#e5e7eb');
  currentY += 35;

  if (products.length === 0) {
    doc.fontSize(11).fillColor('#6b7280').text('No products found', 70, currentY);
    currentY += 30;
  } else {
    // Products table header
    doc.fontSize(10).fillColor('#374151');
    doc.rect(70, currentY - 5, 470, 18).fillAndStroke('#f3f4f6', '#d1d5db');
    doc.fillColor('#000').text('Name', 80, currentY);
    doc.text('Category', 200, currentY);
    doc.text('Unit', 300, currentY);
    doc.text('Price', 400, currentY);
    currentY += 20;

    // Products data (limit to 10 rows)
    const productRows = products.slice(0, 10);
    productRows.forEach((product, index) => {
      if (index % 2 === 0) {
        doc.rect(70, currentY - 3, 470, 16).fillAndStroke('#f9fafb', '#e5e7eb');
      }
      doc.fontSize(9).fillColor('#000');
      doc.text((product.name || 'Unknown').substring(0, 25), 80, currentY);
      doc.text((product.category || 'N/A').substring(0, 15), 200, currentY);
      doc.text(product.unit || 'N/A', 300, currentY);
      // Use unit_price when present; fallback to price_per_unit
      doc.text(formatCurrency(product.unit_price ?? product.price_per_unit ?? 0), 400, currentY);
      currentY += 16;
    });

    if (products.length > 10) {
      doc.fontSize(9).fillColor('#6b7280').text(`... and ${products.length - 10} more products`, 80, currentY + 5);
      currentY += 20;
    }
  }

  // Store Products section
  // Ensure we have enough room; otherwise start a new page
  if (currentY > doc.page.height - 250) {
    doc.addPage();
    currentY = 70;
  }
  currentY += 20;
  doc.fontSize(14).fillColor('#374151').text('Online Store Products', 70, currentY);
  doc.moveTo(70, currentY + 20).lineTo(540, currentY + 20).stroke('#e5e7eb');
  currentY += 35;

  if (storeProducts.length === 0) {
    doc.fontSize(11).fillColor('#6b7280').text('No store products found', 70, currentY);
    currentY += 30;
  } else {
    // Store Products table header
    doc.fontSize(10).fillColor('#374151');
    doc.rect(70, currentY - 5, 470, 18).fillAndStroke('#f3f4f6', '#d1d5db');
    doc.fillColor('#000').text('Name', 80, currentY);
    doc.text('Stock', 280, currentY);
    doc.text('Unit Price', 350, currentY);
    doc.text('Status', 450, currentY);
    currentY += 20;

    // Store Products data (limit to 10 rows)
    const storeProductRows = storeProducts.slice(0, 10);
    storeProductRows.forEach((storeProduct, index) => {
      if (index % 2 === 0) {
        doc.rect(70, currentY - 3, 470, 16).fillAndStroke('#f9fafb', '#e5e7eb');
      }
      doc.fontSize(9).fillColor('#000');
      doc.text((storeProduct.product_name || 'Unknown').substring(0, 30), 80, currentY);
      // Correct field mappings from database.service
      doc.text(String(storeProduct.stock_quantity ?? 0), 280, currentY);
      doc.text(formatCurrency(storeProduct.store_price ?? storeProduct.price_after_discount ?? 0), 350, currentY);
      doc.text(storeProduct.is_available ? 'Available' : 'Unavailable', 450, currentY);
      currentY += 16;
    });

    if (storeProducts.length > 10) {
      doc.fontSize(9).fillColor('#6b7280').text(`... and ${storeProducts.length - 10} more store products`, 80, currentY + 5);
      currentY += 20;
    }
  }

  // Investments section
  if (currentY > doc.page.height - 250) {
    doc.addPage();
    currentY = 70;
  }
  currentY += 20;
  doc.fontSize(14).fillColor('#374151').text('Investments', 70, currentY);
  doc.moveTo(70, currentY + 20).lineTo(540, currentY + 20).stroke('#e5e7eb');
  currentY += 35;

  const investmentTransactions = investments?.transactions || investments || [];
  if (investmentTransactions.length === 0) {
    doc.fontSize(11).fillColor('#6b7280').text('No investments recorded in the selected date range', 70, currentY);
    currentY += 30;
  } else {
    // Investments table header
    doc.fontSize(10).fillColor('#374151');
    doc.rect(70, currentY - 5, 470, 18).fillAndStroke('#f3f4f6', '#d1d5db');
    doc.fillColor('#000').text('Date', 80, currentY);
    doc.text('Type', 140, currentY);
    doc.text('Amount', 280, currentY);
    doc.text('Notes', 350, currentY);
    currentY += 20;

    // Investments data (limit to 10 rows)
    const investmentRows = investmentTransactions.slice(0, 10);
    investmentRows.forEach((investment, index) => {
      if (index % 2 === 0) {
        doc.rect(70, currentY - 3, 470, 16).fillAndStroke('#f9fafb', '#e5e7eb');
      }
      doc.fontSize(9).fillColor('#000');
      const investmentDate = investment.investment_date || investment.created_at;
      doc.text(formatDate(investmentDate), 80, currentY);
      doc.text((investment.investment_type_name || investment.investment_type_id || 'Other').substring(0, 20), 140, currentY);
      doc.text(formatCurrency(investment.amount), 280, currentY);
      doc.text((investment.notes || '').substring(0, 30), 350, currentY);
      currentY += 16;
    });

    if (investmentTransactions.length > 10) {
      doc.fontSize(9).fillColor('#6b7280').text(`... and ${investmentTransactions.length - 10} more investments`, 80, currentY + 5);
      currentY += 20;
    }
  }

  // Orders section
  if (currentY > doc.page.height - 300) {
    doc.addPage();
    currentY = 70;
  }
  currentY += 20;
  doc.fontSize(14).fillColor('#374151').text('Online Orders', 70, currentY);
  doc.moveTo(70, currentY + 20).lineTo(540, currentY + 20).stroke('#e5e7eb');
  currentY += 35;

  if (!ordersData?.orders || ordersData.orders.length === 0) {
    doc.fontSize(11).fillColor('#6b7280').text('No online orders found', 70, currentY);
    currentY += 30;
  } else {
    // Orders table header
    doc.fontSize(10).fillColor('#374151');
    doc.rect(70, currentY - 5, 470, 18).fillAndStroke('#f3f4f6', '#d1d5db');
    doc.fillColor('#000').text('Order ID', 80, currentY);
    doc.text('Status', 180, currentY);
    doc.text('Amount', 280, currentY);
    doc.text('Date', 380, currentY);
    currentY += 20;

    // Orders data (limit to 10 rows)
    const orderRows = ordersData.orders.slice(0, 10);
    orderRows.forEach((order, index) => {
      if (index % 2 === 0) {
        doc.rect(70, currentY - 3, 470, 16).fillAndStroke('#f9fafb', '#e5e7eb');
      }
      doc.fontSize(9).fillColor('#000');
      doc.text(truncateMiddle(order.order_number || order._id || 'N/A', 16), 80, currentY);
      doc.text(safeText(order.status || 'N/A', 14), 180, currentY);
      doc.text(formatCurrency(order.final_amount ?? order.total_amount ?? 0), 280, currentY);
      doc.text(formatDate(order.created_at), 380, currentY);
      // Extra order details line
      const itemsCount = Array.isArray(order.items_details) ? order.items_details.length : 0;
      const payment = order.payment_method ? safeText(String(order.payment_method).toUpperCase(), 12) : 'N/A';
      const customer = truncateMiddle(order.customer_email || 'N/A', 28);
      const phone = truncateMiddle(order.customer_phone || 'N/A', 16);
      doc.fontSize(8).fillColor('#4b5563').text(
        `Customer: ${customer} | Phone: ${phone} | Items: ${itemsCount} | Payment: ${payment} | Delivery Fee: ${formatCurrency(order.delivery_fee ?? 0)}`,
        80,
        currentY + 12,
        { width: 460 }
      );
      currentY += 26;
      // Page break safety within orders loop
      if (currentY > doc.page.height - 120) {
        doc.addPage();
        currentY = 70;
        // Re-draw table header on new page
        doc.fontSize(10).fillColor('#374151');
        doc.rect(70, currentY - 5, 470, 18).fillAndStroke('#f3f4f6', '#d1d5db');
        doc.fillColor('#000').text('Order ID', 80, currentY);
        doc.text('Status', 180, currentY);
        doc.text('Amount', 280, currentY);
        doc.text('Date', 380, currentY);
        currentY += 20;
      }
    });

    if (ordersData.orders.length > 10) {
      doc.fontSize(9).fillColor('#6b7280').text(`... and ${ordersData.orders.length - 10} more orders`, 80, currentY + 5);
      currentY += 20;
    }
  }

  // Sales section
  if (currentY > doc.page.height - 300) {
    doc.addPage();
    currentY = 70;
  }
  currentY += 20;
  doc.fontSize(14).fillColor('#374151').text('Sales Summary', 70, currentY);
  doc.moveTo(70, currentY + 20).lineTo(540, currentY + 20).stroke('#e5e7eb');
  currentY += 35;

  const salesTransactions = sales?.transactions || sales || [];
  if (salesTransactions.length === 0) {
    doc.fontSize(11).fillColor('#6b7280').text('No sales recorded in the selected date range', 70, currentY);
    currentY += 30;
  } else {
    // Sales table header
    doc.fontSize(10).fillColor('#374151');
    doc.rect(70, currentY - 5, 470, 18).fillAndStroke('#f3f4f6', '#d1d5db');
    doc.fillColor('#000').text('Date', 80, currentY);
    doc.text('Product', 140, currentY);
    doc.text('Qty', 280, currentY);
    doc.text('Unit Price', 320, currentY);
    doc.text('Total', 400, currentY);
    doc.text('Profit', 460, currentY);
    currentY += 20;

    // Sales data (limit to 15 rows)
    const salesRows = salesTransactions.slice(0, 15);
    salesRows.forEach((sale, index) => {
      if (index % 2 === 0) {
        doc.rect(70, currentY - 3, 470, 16).fillAndStroke('#f9fafb', '#e5e7eb');
      }
      doc.fontSize(9).fillColor('#000');
      doc.text(formatDate(sale.sale_date), 80, currentY);
      doc.text((sale.product_name || 'Unknown').substring(0, 20), 140, currentY);
      doc.text(sale.quantity_sold || '0', 280, currentY);
      doc.text(formatCurrency(sale.price_per_unit), 320, currentY);
      doc.text(formatCurrency(sale.total_amount), 400, currentY);
      doc.text(formatCurrency(sale.profit), 460, currentY);
      currentY += 16;
      if (currentY > doc.page.height - 120) {
        doc.addPage();
        currentY = 70;
        // Re-draw Sales table header after page break
        doc.fontSize(10).fillColor('#374151');
        doc.rect(70, currentY - 5, 470, 18).fillAndStroke('#f3f4f6', '#d1d5db');
        doc.fillColor('#000').text('Date', 80, currentY);
        doc.text('Product', 140, currentY);
        doc.text('Qty', 280, currentY);
        doc.text('Unit Price', 320, currentY);
        doc.text('Total', 400, currentY);
        doc.text('Profit', 460, currentY);
        currentY += 20;
      }
    });

    if (salesTransactions.length > 15) {
      doc.fontSize(9).fillColor('#6b7280').text(`... and ${salesTransactions.length - 15} more sales`, 80, currentY + 5);
      currentY += 20;
    }
  }

  // Expenses section
  if (currentY > doc.page.height - 280) {
    doc.addPage();
    currentY = 70;
  }
  currentY += 20;
  doc.fontSize(14).fillColor('#374151').text('Expenses Summary', 70, currentY);
  doc.moveTo(70, currentY + 20).lineTo(540, currentY + 20).stroke('#e5e7eb');
  currentY += 35;

  const expenseTransactions = expenses?.transactions || expenses || [];
  if (expenseTransactions.length === 0) {
    doc.fontSize(11).fillColor('#6b7280').text('No expenses recorded in the selected date range', 70, currentY);
  } else {
    // Expenses table header
    doc.fontSize(10).fillColor('#374151');
    doc.rect(70, currentY - 5, 470, 18).fillAndStroke('#f3f4f6', '#d1d5db');
    doc.fillColor('#000').text('Date', 80, currentY);
    doc.text('Type', 140, currentY);
    doc.text('Amount', 280, currentY);
    doc.text('Notes', 350, currentY);
    currentY += 20;

    // Expenses data (limit to 15 rows)
    const expenseRows = expenseTransactions.slice(0, 15);
    expenseRows.forEach((expense, index) => {
      if (index % 2 === 0) {
        doc.rect(70, currentY - 3, 470, 16).fillAndStroke('#f9fafb', '#e5e7eb');
      }
      doc.fontSize(9).fillColor('#000');
      const expenseDate = expense.expense_date || expense.created_at;
      doc.text(formatDate(expenseDate), 80, currentY);
      doc.text((expense.expense_type_name || expense.expense_type_id || 'Other').substring(0, 20), 140, currentY);
      doc.text(formatCurrency(expense.amount), 280, currentY);
      doc.text((expense.notes || '').substring(0, 30), 350, currentY);
      currentY += 16;
      if (currentY > doc.page.height - 120) {
        doc.addPage();
        currentY = 70;
        // Re-draw Expenses table header after page break
        doc.fontSize(10).fillColor('#374151');
        doc.rect(70, currentY - 5, 470, 18).fillAndStroke('#f3f4f6', '#d1d5db');
        doc.fillColor('#000').text('Date', 80, currentY);
        doc.text('Type', 140, currentY);
        doc.text('Amount', 280, currentY);
        doc.text('Notes', 350, currentY);
        currentY += 20;
      }
    });

    if (expenseTransactions.length > 15) {
      doc.fontSize(9).fillColor('#6b7280').text(`... and ${expenseTransactions.length - 15} more expenses`, 80, currentY + 5);
    }
  }

  // Footer
  doc.fontSize(8).fillColor('#6b7280').text(
    `Generated by FarmFresh BD on ${new Date().toLocaleString('en-BD')}`,
    70, 
    doc.page.height - 50,
    { align: 'center', width: 470 }
  );

  doc.end();
}));

// Generate CSV report
router.get('/csv', authenticate, asyncHandler(async (req, res) => {
  const { farm_id, type = 'all-time', start_date, end_date } = req.query;

  if (!farm_id || !isValidUUID(farm_id)) {
    return res.status(400).json({ error: 'Valid farm_id is required' });
  }

  const hasAccess = await DatabaseService.verifyFarmOwnership(farm_id, req.user.userId);
  if (!hasAccess) {
    return res.status(403).json({ error: 'Access denied to this farm' });
  }

  const { startDate, endDate: endDateResolved } = resolveDateRange({ type, start_date, end_date });

  // Get farm details and all data
  const farm = await DatabaseService.getFarmById(farm_id);
  const stats = await DatabaseService.getFarmStats(farm_id);
  const sales = await DatabaseService.getSalesByFarmWithFilters(farm_id, { start_date: startDate, end_date: endDateResolved });
  const expenses = await DatabaseService.getExpensesByFarmWithFilters(farm_id, { start_date: startDate, end_date: endDateResolved });
  const storeProducts = await DatabaseService.getStoreProductsByFarmId(farm_id);
  const ordersData = await DatabaseService.getFarmOrders(farm_id, { limit: 100 });

  let csv = '';
  
  // Header section with farm information
  csv += '=== FARMFRESH BD REPORT ===\n';
  csv += '\n';
  csv += 'FARM INFORMATION\n';
  csv += 'Field,Value\n';
  csv += `"Farm Name","${(farm?.name || 'N/A').replace(/"/g, '""')}"\n`;
  csv += `"Farm ID","${farm_id}"\n`;
  csv += `"Farm Type","${(farm?.type || 'N/A').replace(/"/g, '""')}"\n`;
  csv += `"Address","${(farm?.address || 'N/A').replace(/"/g, '""')}"\n`;
  csv += `"Location","${(farm?.location || 'N/A').replace(/"/g, '""')}"\n`;
  csv += `"Report Generated","${formatDate(new Date())}"\n`;
  csv += `"Date Range","${formatDate(startDate)} to ${formatDate(endDateResolved)}"\n`;
  csv += '\n';

  // Key Performance Metrics section
  csv += 'KEY PERFORMANCE METRICS\n';
  csv += 'Metric,Value (BDT),Formatted Value\n';
  csv += `"Total Sales Revenue",${stats?.total_sales || 0},"${formatCurrency(stats?.total_sales)}"\n`;
  csv += `"Total Expenses",${stats?.total_expenses || 0},"${formatCurrency(stats?.total_expenses)}"\n`;
  csv += `"Total Investments",${stats?.total_investments || 0},"${formatCurrency(stats?.total_investments)}"\n`;
  csv += `"Gross Profit",${stats?.gross_profit || 0},"${formatCurrency(stats?.gross_profit)}"\n`;
  csv += `"ROI Percentage",${Number(stats?.roi || 0).toFixed(2)},"${Number(stats?.roi || 0).toFixed(2)}%"\n`;
  csv += `"Total Products",${stats?.product_count || 0},"${stats?.product_count || 0} products"\n`;
  csv += `"Products Sold",${stats?.sold_product_count || 0},"${stats?.sold_product_count || 0} products"\n`;
  csv += '\n';

  // Sales section
  csv += 'SALES TRANSACTIONS\n';
  if (sales.length === 0) {
    csv += 'No sales recorded in the selected date range\n';
  } else {
    csv += 'Sale ID,Date,Product Name,Quantity Sold,Unit Price (BDT),Total Amount (BDT),Profit (BDT),Product ID\n';
    sales.forEach(sale => {
      const saleDate = sale.sale_date?.toISOString ? sale.sale_date.toISOString().slice(0,10) : (sale.sale_date || 'N/A');
      const productName = (sale.product_name || 'Unknown Product').replace(/"/g, '""');
      csv += `"${sale._id || sale.id}","${saleDate}","${productName}",${sale.quantity_sold || 0},${sale.price_per_unit || 0},${sale.total_amount || 0},${sale.profit || 0},"${sale.product_id || ''}"\n`;
    });
  }
  csv += '\n';

  // Sales summary by product
  if (sales.length > 0) {
    csv += 'SALES SUMMARY BY PRODUCT\n';
    const productSummary = {};
    sales.forEach(sale => {
      const productName = sale.product_name || 'Unknown Product';
      if (!productSummary[productName]) {
        productSummary[productName] = {
          totalQuantity: 0,
          totalRevenue: 0,
          totalProfit: 0,
          salesCount: 0
        };
      }
      productSummary[productName].totalQuantity += Number(sale.quantity_sold || 0);
      productSummary[productName].totalRevenue += Number(sale.total_amount || 0);
      productSummary[productName].totalProfit += Number(sale.profit || 0);
      productSummary[productName].salesCount += 1;
    });

    csv += 'Product Name,Total Quantity Sold,Total Revenue (BDT),Total Profit (BDT),Number of Sales,Average Sale Value (BDT)\n';
    Object.entries(productSummary).forEach(([productName, summary]) => {
      const avgSaleValue = summary.salesCount > 0 ? (summary.totalRevenue / summary.salesCount).toFixed(2) : 0;
      csv += `"${productName.replace(/"/g, '""')}",${summary.totalQuantity},${summary.totalRevenue.toFixed(2)},${summary.totalProfit.toFixed(2)},${summary.salesCount},${avgSaleValue}\n`;
    });
    csv += '\n';
  }

  // Expenses section
  csv += 'EXPENSE TRANSACTIONS\n';
  if (expenses.length === 0) {
    csv += 'No expenses recorded in the selected date range\n';
  } else {
    csv += 'Expense ID,Date,Expense Type,Amount (BDT),Notes,Category\n';
    expenses.forEach(expense => {
      const expenseDate = expense.expense_date?.toISOString ? expense.expense_date.toISOString().slice(0,10) : 
                         (expense.created_at?.toISOString ? expense.created_at.toISOString().slice(0,10) : 'N/A');
      const expenseType = (expense.expense_type_name || expense.expense_type_id || 'Other').replace(/"/g, '""');
      const notes = (expense.notes || '').replace(/"/g, '""');
      csv += `"${expense.id}","${expenseDate}","${expenseType}",${expense.amount || 0},"${notes}","${expense.category || 'N/A'}"\n`;
    });
  }
  csv += '\n';

  // Expense summary by type
  if (expenses.length > 0) {
    csv += 'EXPENSE SUMMARY BY TYPE\n';
    const expenseSummary = {};
    expenses.forEach(expense => {
      const expenseType = expense.expense_type_name || expense.expense_type_id || 'Other';
      if (!expenseSummary[expenseType]) {
        expenseSummary[expenseType] = {
          totalAmount: 0,
          expenseCount: 0
        };
      }
      expenseSummary[expenseType].totalAmount += Number(expense.amount || 0);
      expenseSummary[expenseType].expenseCount += 1;
    });

    csv += 'Expense Type,Total Amount (BDT),Number of Expenses,Average Expense (BDT),Percentage of Total\n';
    const totalExpenses = Object.values(expenseSummary).reduce((sum, summary) => sum + summary.totalAmount, 0);
    Object.entries(expenseSummary).forEach(([expenseType, summary]) => {
      const avgExpense = summary.expenseCount > 0 ? (summary.totalAmount / summary.expenseCount).toFixed(2) : 0;
      const percentage = totalExpenses > 0 ? ((summary.totalAmount / totalExpenses) * 100).toFixed(2) : 0;
      csv += `"${expenseType.replace(/"/g, '""')}",${summary.totalAmount.toFixed(2)},${summary.expenseCount},${avgExpense},${percentage}%\n`;
    });
    csv += '\n';
  }

  // Store Products section
  csv += 'ONLINE STORE PRODUCTS\n';
  if (storeProducts.length === 0) {
    csv += 'No products available in online store\n';
  } else {
    csv += 'Product ID,Product Name,Category,Price (BDT),Stock Quantity,Available,Description,Image URL\n';
    storeProducts.forEach(product => {
      const productName = (product.name || 'Unknown Product').replace(/"/g, '""');
      const category = (product.category || 'N/A').replace(/"/g, '""');
      const description = (product.description || '').replace(/"/g, '""');
      const imageUrl = (product.image_url || '').replace(/"/g, '""');
      const isAvailable = product.is_available ? 'Yes' : 'No';
      csv += `"${product.id}","${productName}","${category}",${product.price || 0},${product.stock_quantity || 0},"${isAvailable}","${description}","${imageUrl}"\n`;
    });
  }
  csv += '\n';

  // Online Orders section
  csv += 'ONLINE ORDERS\n';
  const orders = ordersData?.orders || ordersData || [];
  if (orders.length === 0) {
    csv += 'No online orders found\n';
  } else {
    csv += 'Order ID,Order Date,Customer Name,Customer Email,Status,Total Amount (BDT),Delivery Fee (BDT),Items Count,Payment Method\n';
    orders.forEach(order => {
      const orderDate = order.created_at?.toISOString ? order.created_at.toISOString().slice(0,10) : (order.created_at || 'N/A');
      const customerName = (order.customer_name || 'N/A').replace(/"/g, '""');
      const customerEmail = (order.customer_email || 'N/A').replace(/"/g, '""');
      const status = (order.status || 'N/A').replace(/"/g, '""');
      const paymentMethod = (order.payment_method || 'N/A').replace(/"/g, '""');
      const itemsCount = order.items ? order.items.length : 0;
      csv += `"${order.id}","${orderDate}","${customerName}","${customerEmail}","${status}",${order.total_amount || 0},${order.delivery_fee || 0},${itemsCount},"${paymentMethod}"\n`;
    });
  }
  csv += '\n';

  // Footer
  csv += 'REPORT METADATA\n';
  csv += 'Field,Value\n';
  csv += `"Generated By","FarmFresh BD System"\n`;
  csv += `"Generation Time","${new Date().toLocaleString('en-BD')}"\n`;
  csv += `"Total Sales Records",${sales.length}\n`;
  csv += `"Total Expense Records",${expenses.length}\n`;
  csv += `"Total Store Products",${storeProducts.length}\n`;
  csv += `"Total Online Orders",${orders.length}\n`;
  csv += `"Data Export Format","CSV"\n`;

  const filename = `${(farm?.name || 'farm').replace(/[^a-zA-Z0-9]/g, '_')}-report-${new Date().toISOString().slice(0,10)}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.status(200).send(csv);
}));

module.exports = router;