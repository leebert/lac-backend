import { logRequest } from '../config/logger.js';

/**
 * Middleware to track request metrics: duration, status codes, endpoints
 */
export function requestMetrics(req, res, next) {
  const startTime = Date.now();
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);
  
  // Capture sessionId from request body if available
  const sessionId = req.body?.sessionId;
  
  // Override res.json to capture when response is sent
  res.json = function(body) {
    logRequestMetrics();
    return originalJson(body);
  };
  
  // Override res.send to capture when response is sent
  res.send = function(body) {
    logRequestMetrics();
    return originalSend(body);
  };
  
  function logRequestMetrics() {
    const duration = Date.now() - startTime;
    
    logRequest({
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      sessionId,
      error: res.statusCode >= 400 ? res.locals.error : null
    });
  }
  
  next();
}
