@echo off
echo.
echo ========================================
echo   FarmFresh BD - Expense Types Init
echo ========================================
echo.

echo Initializing default expense types...
echo.

node scripts/init-expense-types.js

echo.
echo ========================================
echo   Initialization Complete
echo ========================================
echo.
pause