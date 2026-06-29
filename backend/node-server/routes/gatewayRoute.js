const express = require('express');
const axios = require('axios');
const { authenticateToken } = require('../middlewares/auth');
const logger = require('../middlewares/logger');

const router = express.Router();
const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8000';

router.all('/*', authenticateToken, async (req, res) => {
  const targetUrl = `${FASTAPI_URL}/api${req.path}`;
  logger.info(`Proxying ${req.method} request to: ${targetUrl}`);
  
  try {
    const response = await axios({
      method: req.method,
      url: targetUrl,
      data: req.body,
      params: req.query,
      headers: {
        ...req.headers,
        'X-User-Id': req.user.id || '',
        'X-User-Email': req.user.email || '',
        'X-User-Role': req.user.role || '',
        'X-User-Name': req.user.name || '',
        'host': undefined
      },
      responseType: req.path.includes('/reports/export') ? 'arraybuffer' : 'json'
    });

    if (req.path.includes('/reports/export')) {
      res.setHeader('Content-Type', response.headers['content-type'] || 'text/csv');
      res.setHeader('Content-Disposition', response.headers['content-disposition'] || 'attachment; filename=report.csv');
      return res.send(response.data);
    }
    
    return res.status(response.status).json(response.data);
  } catch (err) {
    if (err.response) {
      logger.error(`FastAPI error (${err.response.status}): ${err.response.data ? err.response.data.toString() : 'Empty data'}`);
      
      // Parse error response if it is json
      try {
        const errorData = JSON.parse(err.response.data.toString());
        return res.status(err.response.status).json(errorData);
      } catch (e) {
        return res.status(err.response.status).send(err.response.data);
      }
    }
    logger.error(`Gateway proxy error: ${err.message}`);
    return res.status(502).json({ message: 'Bad Gateway: FastAPI server is down or timed out' });
  }
});

module.exports = router;
