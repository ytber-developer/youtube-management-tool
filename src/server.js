require('dotenv').config();

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const routes = require('./routes');
const { sequelize } = require('./models');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', routes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Automation API is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Error:', err);
  
  if (process.env.NODE_ENV === 'development') {
    console.error('Stack trace:', err.stack);
  }
  
  res.status(500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start server
const startServer = async () => {
  try {
    await sequelize.authenticate();

    // Removed auto-sync to avoid "Too many keys" error
    // Run migrations manually with: npm run migrate

    // Recovery: reset any tasks/campaigns stuck in 'running' from a previous crash
    const { startCron, recoverStuckTasks } = require('./services/campaign.service');
    await recoverStuckTasks();

    // Start campaign cron (every 5 minutes)
    startCron();

    // Recovery: reset upload jobs stuck in downloading/uploading from a previous crash
    const { startUploadCron, recoverStuckUploads } = require('./services/upload.queue.service');
    await recoverStuckUploads();

    // Start upload queue cron (every 5 minutes, processes 1 job at a time)
    startUploadCron();

    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('❌ Stack:', error.stack);
    process.exit(1);
  }
};

startServer();

module.exports = app;
