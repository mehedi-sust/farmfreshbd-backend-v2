/**
 * Request/Response Logger Middleware
 * Logs all API requests and responses like FastAPI
 */

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  
  // Foreground colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  
  // Background colors
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
};

/**
 * Get color for HTTP status code
 */
function getStatusColor(statusCode) {
  if (statusCode >= 500) return colors.red;
  if (statusCode >= 400) return colors.yellow;
  if (statusCode >= 300) return colors.cyan;
  if (statusCode >= 200) return colors.green;
  return colors.white;
}

/**
 * Get color for HTTP method
 */
function getMethodColor(method) {
  const methodColors = {
    GET: colors.blue,
    POST: colors.green,
    PUT: colors.yellow,
    DELETE: colors.red,
    PATCH: colors.magenta,
  };
  return methodColors[method] || colors.white;
}

/**
 * Format duration
 */
function formatDuration(ms) {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Request Logger Middleware
 */
function requestLogger(req, res, next) {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  
  // Log incoming request
  const methodColor = getMethodColor(req.method);
  console.log(
    `${colors.dim}[${timestamp}]${colors.reset} ` +
    `${methodColor}${req.method}${colors.reset} ` +
    `${colors.cyan}${req.path}${colors.reset}`
  );
  
  // Log request body for POST/PUT/PATCH (excluding passwords)
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
    const sanitizedBody = { ...req.body };
    if (sanitizedBody.password) sanitizedBody.password = '***';
    if (sanitizedBody.hashed_password) sanitizedBody.hashed_password = '***';
    console.log(`  ${colors.dim}Body:${colors.reset}`, JSON.stringify(sanitizedBody));
  }
  
  // Log query parameters
  if (Object.keys(req.query).length > 0) {
    console.log(`  ${colors.dim}Query:${colors.reset}`, req.query);
  }
  
  // Capture response
  const originalSend = res.send;
  res.send = function (data) {
    const duration = Date.now() - startTime;
    const statusColor = getStatusColor(res.statusCode);
    
    // Log response
    console.log(
      `${colors.dim}[${new Date().toISOString()}]${colors.reset} ` +
      `${methodColor}${req.method}${colors.reset} ` +
      `${colors.cyan}${req.path}${colors.reset} ` +
      `${statusColor}${res.statusCode}${colors.reset} ` +
      `${colors.dim}${formatDuration(duration)}${colors.reset}`
    );
    
    // Log response body for errors
    if (res.statusCode >= 400) {
      try {
        const responseData = typeof data === 'string' ? JSON.parse(data) : data;
        console.log(`  ${colors.red}Error:${colors.reset}`, responseData);
      } catch (e) {
        // Ignore parse errors
      }
    }
    
    console.log(''); // Empty line for readability
    
    originalSend.call(this, data);
  };
  
  next();
}

/**
 * Error Logger Middleware
 */
function errorLogger(err, req, res, next) {
  console.error(`${colors.red}${colors.bright}ERROR:${colors.reset}`);
  console.error(`  ${colors.red}Message:${colors.reset}`, err.message);
  console.error(`  ${colors.red}Path:${colors.reset}`, `${req.method} ${req.path}`);
  if (err.stack) {
    console.error(`  ${colors.dim}Stack:${colors.reset}`);
    console.error(err.stack);
  }
  console.log('');
  next(err);
}

module.exports = { requestLogger, errorLogger };
