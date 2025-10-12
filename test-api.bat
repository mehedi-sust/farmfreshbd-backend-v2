@echo off
echo ========================================
echo Testing FarmFresh BD API
echo ========================================
echo.

echo [1/5] Testing Health Endpoint...
curl -s http://localhost:8000/health
echo.
echo.

echo [2/5] Testing API Info...
curl -s http://localhost:8000/
echo.
echo.

echo [3/5] Testing Registration...
curl -X POST http://localhost:8000/register ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"test%RANDOM%@example.com\",\"password\":\"password123\",\"role\":\"farmer\"}"
echo.
echo.

echo [4/5] Testing Login...
curl -X POST http://localhost:8000/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"test@example.com\",\"password\":\"password123\"}"
echo.
echo.

echo [5/5] Testing Store Products...
curl -s http://localhost:8000/store_products
echo.
echo.

echo ========================================
echo API Test Complete!
echo ========================================
echo.
echo Check the server console for detailed logs
echo.
pause
