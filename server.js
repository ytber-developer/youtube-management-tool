const express = require('express');
const bodyParser = require('body-parser');
const cron = require('node-cron');
const automationService = require('./services/automationService');
const facebookReelRoutes = require('./src/routes/facebook.reel.routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

// Đăng ký route facebook.reel.routes.js vào app Express
app.use('/api/v1/facebook', facebookReelRoutes);

// API endpoint để trigger automation manually
app.post('/api/automation/click-action', async (req, res) => {
  try {
    const { url, selector, action } = req.body;
    
    if (!url || !selector) {
      return res.status(400).json({ 
        success: false, 
        message: 'URL và selector là bắt buộc' 
      });
    }

    const result = await automationService.performClickAction(url, selector, action);
    
    res.json({ 
      success: true, 
      message: 'Automation task completed',
      data: result 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// API endpoint để fill form
app.post('/api/automation/fill-form', async (req, res) => {
  try {
    const { url, formData } = req.body;
    
    const result = await automationService.fillForm(url, formData);
    
    res.json({ 
      success: true, 
      message: 'Form filled successfully',
      data: result 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// API endpoint để scrape data
app.post('/api/automation/scrape', async (req, res) => {
  try {
    const { url, selectors } = req.body;
    
    const result = await automationService.scrapeData(url, selectors);
    
    res.json({ 
      success: true, 
      data: result 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// Cronjob - chạy mỗi ngày lúc 9:00 sáng
cron.schedule('0 9 * * *', async () => {
  console.log('Running scheduled automation task...');
  try {
    await automationService.scheduledTask();
    console.log('Scheduled task completed successfully');
  } catch (error) {
    console.error('Scheduled task failed:', error);
  }
});

// Cronjob - chạy mỗi 30 phút
cron.schedule('*/30 * * * *', async () => {
  console.log('Running 30-minute automation check...');
  try {
    await automationService.periodicCheck();
  } catch (error) {
    console.error('Periodic check failed:', error);
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Automation API server running on port ${PORT}`);
  console.log(`📅 Cronjobs are scheduled and active`);
});
