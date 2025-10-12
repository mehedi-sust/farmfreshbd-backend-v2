@echo off
echo ========================================
echo FarmFresh BD API - Quick Setup
echo ========================================
echo.

echo [1/5] Installing dependencies...
call npm install
if errorlevel 1 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)
echo ✓ Dependencies installed
echo.

echo [2/5] Setting up environment...
if not exist .env (
    copy .env.example .env
    echo ✓ Created .env file
    echo.
    echo IMPORTANT: Edit .env file with your MongoDB URI and JWT secret
    echo.
) else (
    echo ✓ .env file already exists
    echo.
)

echo [3/5] Running tests...
call npm test
if errorlevel 1 (
    echo WARNING: Some tests failed
    echo.
) else (
    echo ✓ All tests passed
    echo.
)

echo [4/5] Generating API documentation...
call npm run docs
if errorlevel 1 (
    echo WARNING: Documentation generation failed
    echo.
) else (
    echo ✓ Documentation generated in docs/ folder
    echo.
)

echo [5/5] Setup complete!
echo.
echo ========================================
echo Next Steps:
echo ========================================
echo 1. Edit .env file with your MongoDB URI
echo 2. Run: npm run dev (start development server)
echo 3. Run: npm test (run tests)
echo 4. Run: vercel (deploy to Vercel)
echo.
echo Documentation:
echo - README.md - Main documentation
echo - TESTING_GUIDE.md - Testing guide
echo - MIGRATION_GUIDE.md - Migration from FastAPI
echo - docs/index.html - API documentation
echo.
echo ========================================
pause
