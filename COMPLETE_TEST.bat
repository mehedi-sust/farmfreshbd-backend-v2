@echo off
echo ========================================
echo Complete Finance System Test
echo ========================================
echo.
echo This will test:
echo 1. Database collections separation
echo 2. API endpoints functionality
echo.
echo Make sure the backend server is running!
echo.
pause
echo.

echo Step 1: Checking database collections...
echo ========================================
node check-collections.js
echo.
echo.

echo Step 2: Testing collection separation...
echo ========================================
node test-separation.js
echo.
echo.

echo Step 3: Testing API endpoints...
echo ========================================
echo NOTE: This requires the backend server to be running
node test-api-endpoints.js
echo.
echo.

echo ========================================
echo All tests complete!
echo ========================================
pause
