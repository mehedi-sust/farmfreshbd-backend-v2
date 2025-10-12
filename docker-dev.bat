@echo off
echo ========================================
echo FarmFresh BD API - Docker Development
echo ========================================
echo.

echo Starting services with Docker Compose...
echo.
echo Services:
echo - MongoDB: localhost:27017
echo - API: http://localhost:8000
echo.
echo Press Ctrl+C to stop all services
echo.

docker-compose up
