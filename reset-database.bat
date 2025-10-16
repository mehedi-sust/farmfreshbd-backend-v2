@echo off
echo ===================================================
echo FarmFreshBD Database Reset Tool
echo ===================================================
echo WARNING: This will delete ALL data in your database!
echo.
echo Press Ctrl+C to cancel or any key to continue...
pause > nul

node src/scripts/reset-database.js

echo.
echo ===================================================
echo Database reset complete!
echo You can now restart the server and create a new account.
echo ===================================================
pause