@echo off
echo ========================================
echo Testing Frontend Compatibility
echo ========================================
echo.

echo Testing FastAPI-style paths (what frontend uses)...
echo.

echo [1/5] Testing /store_products...
curl -s http://localhost:8000/store_products
echo.
echo.

echo [2/5] Testing /health...
curl -s http://localhost:8000/health
echo.
echo.

echo [3/5] Testing / (API info)...
curl -s http://localhost:8000/
echo.
echo.

echo Testing new-style paths (with /api prefix)...
echo.

echo [4/5] Testing /api/store_products...
curl -s http://localhost:8000/api/store_products
echo.
echo.

echo [5/5] Testing /docs...
echo Visit: http://localhost:8000/docs
echo.

echo ========================================
echo Compatibility Test Complete!
echo ========================================
echo.
echo If you see JSON responses above, the backend is working!
echo.
echo Next: Start frontend with 'npm run dev' in farmfreshbd-frontend
echo.
pause
