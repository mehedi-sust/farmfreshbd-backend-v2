# Testing CSV Fixes and Custom Reports

## 🚀 Quick Start

### 1. Start the Backend Server
```bash
cd farmfreshbd-backend-v2
npm start
```

### 2. Start the Frontend
```bash
cd farmfreshbd-frontend
npm run dev
```

### 3. Access Reports Page
1. Login to the application
2. Navigate to Farm Manager → Reports
3. You'll see the new "Custom Date Range Reports" section

## 🧪 Testing Scenarios

### Test 1: Date Formatting Fix
1. Export any CSV report (Financial, Products, or Sales Analysis)
2. Open in Excel or Google Sheets
3. ✅ Verify dates show as YYYY-MM-DD format (no #### symbols)

### Test 2: Data Swapping Fix
1. Export "All Data" CSV
2. Check the sections:
   - ✅ EXPENSES section should contain expense data
   - ✅ INVESTMENTS section should contain investment data
   - ✅ No data swapping between sections

### Test 3: Custom Date Range
1. Go to "Custom Date Range Reports" section
2. Select start date (e.g., 2024-01-01)
3. Select end date (e.g., 2024-06-30)
4. Click any export button (All Data, Financial, Products, Sales)
5. ✅ Verify only data within the date range is exported
6. ✅ Check filename includes date range

### Test 4: Number Formatting
1. Export Financial Analysis CSV
2. Check amount columns
3. ✅ All amounts should have 2 decimal places (e.g., 150.00, not 150)
4. ✅ No scientific notation or formatting issues

### Test 5: Error Handling
1. Try custom export without selecting dates
2. ✅ Should show error message "Date Range Required"
3. Select end date before start date
4. ✅ Should show error "Start date must be before end date"

## 📊 Expected CSV Structure

### Financial Analysis
```csv
Date,Type,Description,Amount,Category
2024-01-15,Income,Sale: Product A (10 units),150.00,Sales Revenue
2024-01-16,Expense,Seeds and fertilizer,75.50,Seeds
2024-01-17,Investment,New equipment,500.00,Equipment
```

### All Data Export
```csv
PRODUCTS
Name,Type,Quantity,Unit Price,Total Value,Status,Product Batch,Created Date
Product A,Vegetable,100,15.00,1500.00,Active,BATCH-1,2024-01-15

SALES
Product Name,Quantity Sold,Price Per Unit,Total Revenue,Sale Date,Profit
Product A,10,15.00,150.00,2024-01-15,45.00

EXPENSES
Description,Amount,Category,Date,Product Batch
Seeds,75.50,Seeds,2024-01-16,BATCH-1

INVESTMENTS
Description,Amount,Investment Type,Date
Equipment,500.00,Equipment,2024-01-17
```

## 🔍 Verification Checklist

- [ ] No #### symbols in date columns
- [ ] Expenses and investments in correct sections
- [ ] Custom date range filtering works
- [ ] All amounts have 2 decimal places
- [ ] CSV files open correctly in Excel
- [ ] Error messages show for invalid inputs
- [ ] File names include date ranges for custom reports
- [ ] All report types (Financial, Products, Sales, All Data) work

## 🐛 Troubleshooting

### Issue: Server not starting
**Solution**: Check if port 3001 is available, install dependencies with `npm install`

### Issue: CSV shows garbled text
**Solution**: Open CSV with UTF-8 encoding in Excel (Data → From Text/CSV → UTF-8)

### Issue: Dates still showing ####
**Solution**: Widen the date column in Excel or check if data is actually in YYYY-MM-DD format

### Issue: Custom date range not working
**Solution**: Ensure both start and end dates are selected, check browser console for errors

## 📞 Support

If you encounter any issues:
1. Check browser console for JavaScript errors
2. Check backend logs for API errors
3. Verify test data exists in the date range you selected
4. Try with a wider date range (e.g., entire year)

## ✅ Success Criteria

The fixes are working correctly if:
1. ✅ All CSV exports have properly formatted dates (YYYY-MM-DD)
2. ✅ No data swapping between expenses and investments
3. ✅ Custom date range reports filter data correctly
4. ✅ All numbers have consistent decimal formatting
5. ✅ CSV files are Excel-compatible
6. ✅ User-friendly error messages for invalid inputs