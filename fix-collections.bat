@echo off
echo ========================================
echo Fixing Product Batches and Expense Types Collections
echo ========================================
echo.
echo This will move expense types from product_batches to expense_types collection
echo.
pause
echo.
node fix-collections.js
echo.
pause
