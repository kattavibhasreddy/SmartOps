const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const logger = require('./logger');
const routes = require('./routes');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

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

const PORT = process.env.PORT || 4003;

app.listen(PORT, () => {
  logger.info(`Notification service listening on port ${PORT}`);
});
