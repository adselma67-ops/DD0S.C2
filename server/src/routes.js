const express = require('express');
const { createTestRun, stopTestRun, getTargetState, listNodes, listTests, getGeoip } = require('./controllers');

const router = express.Router();

function authMiddleware(req, res, next) {
  const provided = req.headers.authorization || '';
  const token = provided.startsWith('Bearer ') ? provided.slice(7) : provided;
  const validToken = req.app.locals.apiToken || 'nexus-demo-token';

  if (!token || token !== validToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  return next();
}

router.get('/health', (req, res) => {
  res.json({ ok: true, tokenConfigured: Boolean(req.app.locals.apiToken) });
});
router.post('/test/start', authMiddleware, createTestRun);
router.post('/test/:id/stop', authMiddleware, stopTestRun);
router.get('/target-state/:ip', authMiddleware, getTargetState);
router.get('/nodes', authMiddleware, listNodes);
router.get('/tests', authMiddleware, listTests);
router.get('/geoip/:ip', authMiddleware, getGeoip);

module.exports = router;
