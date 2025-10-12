@echo off
echo ========================================
echo FarmFresh BD API - Docker Tests
echo ========================================
echo.

echo Running tests in Docker...
docker-compose -f docker-compose.test.yml up --build --abort-on-container-exit

echo.
echo Cleaning up test containers...
docker-compose -f docker-compose.test.yml down

echo.
echo ========================================
echo Test run complete!
echo ========================================
pause
