# Convert Express app files to router format
$apiFiles = @("farms.js", "products.js", "stats.js", "admin.js")

foreach ($file in $apiFiles) {
    $filePath = "api/$file"
    Write-Host "Converting $file..."
    
    # Read file content
    $content = Get-Content $filePath -Raw
    
    # Replace app with router
    $content = $content -replace "const app = express\(\);", "const router = express.Router();"
    $content = $content -replace "app\.use\(cors\(\)\);", ""
    $content = $content -replace "app\.use\(express\.json\(\)\);", ""
    $content = $content -replace "app\.(get|post|put|delete)", "router.`$1"
    $content = $content -replace "module\.exports = app;", "module.exports = router;"
    $content = $content -replace "const cors = require\('cors'\);", ""
    
    # Write back to file
    Set-Content $filePath $content -NoNewline
    
    Write-Host "Converted $file"
}

Write-Host "All files converted!"