const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const { createProxyMiddleware } = require('http-proxy-middleware');
const logger = require('./logger');

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key';

const publicRoutes = [
  '/api/auth/register',
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/auth/health',
  '/api/incidents/health',
  '/api/notifications/health'
];

const authMiddleware = (req, res, next) => {
  if (publicRoutes.includes(req.path)) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    logger.error('JWT Verification failed:', err.message);
    return res.status(401).json({ error: { message: 'Invalid or expired token', code: 'INVALID_TOKEN' } });
  }
};

app.use(authMiddleware);

const addContextHeaders = (proxyReq, req, res) => {
  if (req.user) {
    proxyReq.setHeader('x-user-id', req.user.sub);
    proxyReq.setHeader('x-user-role', req.user.role);
  }
};

const proxyOptions = {
  changeOrigin: true,
  onProxyReq: addContextHeaders,
  logProvider: () => logger,
};

app.use('/api/auth', createProxyMiddleware({
  ...proxyOptions,
  target: process.env.AUTH_SERVICE_URL || 'http://auth-service:4001',
  pathRewrite: { '^/api/auth': '' }
}));

app.use('/api/incidents', createProxyMiddleware({
  ...proxyOptions,
  target: process.env.INCIDENT_SERVICE_URL || 'http://incident-service:4002',
  pathRewrite: { '^/api/incidents': '' }
}));

app.use('/api/notifications', createProxyMiddleware({
  ...proxyOptions,
  target: process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:4003',
  pathRewrite: { '^/api/notifications': '' }
}));

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  logger.info(`Gateway service listening on port ${PORT}`);
});
