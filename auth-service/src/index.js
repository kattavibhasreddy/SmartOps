const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const logger = require('./logger');
const routes = require('./routes');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: { message: 'Too many requests, please try again later.', code: 'RATE_LIMIT_EXCEEDED' } }
});
app.use('/register', limiter);
app.use('/login', limiter);

app.use('/', routes);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(err.message, { stack: err.stack });
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal Server Error',
      code: err.code || 'INTERNAL_ERROR'
    }
  });
});

const PORT = process.env.PORT || 4001;

app.listen(PORT, () => {
  logger.info(`Auth service listening on port ${PORT}`);
});
