@echo off
echo.
echo ========================================
echo   FarmFresh BD - Test Data Cleaner
echo ========================================
echo.

if "%1"=="show" (
    echo 📊 Showing current data...
    node tests/delete-test-data.js --show
) else if "%1"=="clean" (
    echo 🧹 Cleaning test data...
    echo.
    echo ⚠️  WARNING: This will delete test users and their data!
    echo    Only users/farms with 'test', 'demo', or 'dummy' in names will be deleted.
    echo    Admin users are protected.
    echo.
    set /p confirm="Are you sure? (y/N): "
    if /i "%confirm%"=="y" (
        node tests/delete-test-data.js --clean
    ) else (
        echo ❌ Operation cancelled.
    )
) else (
    echo Usage:
    echo   clean-test-data.bat show    - Show current data
    echo   clean-test-data.bat clean   - Clean test data
    echo.
    echo Examples:
    echo   clean-test-data.bat show
    echo   clean-test-data.bat clean
)

echo.
pause