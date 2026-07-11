const express = require('express');
const { z } = require('zod');
const db = require('./db');
const logger = require('./logger');

const router = express.Router();

const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'internal_secret_token_123';

router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'notification-service' });
});

router.get('/', async (req, res, next) => {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } });

  const page = parseInt(req.query.page || '1', 10);
  const pageSize = parseInt(req.query.pageSize || '20', 10);
  const offset = (page - 1) * pageSize;

  try {
    const notifications = await db('notifications.notifications')
      .where({ user_id: userId })
      .orderBy('created_at', 'desc')
      .limit(pageSize)
      .offset(offset);

    res.json(notifications);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/read', async (req, res, next) => {
  const userId = req.headers['x-user-id'];
  try {
    const [notification] = await db('notifications.notifications')
      .where({ id: req.params.id, user_id: userId })
      .update({ read: true })
      .returning('*');
    
    if (!notification) return res.status(404).json({ error: { message: 'Not found' } });
    res.json(notification);
  } catch (err) {
    next(err);
  }
});

router.patch('/read-all', async (req, res, next) => {
  const userId = req.headers['x-user-id'];
  try {
    await db('notifications.notifications')
      .where({ user_id: userId, read: false })
      .update({ read: true });
    
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.get('/unread-count', async (req, res, next) => {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } });

  try {
    const result = await db('notifications.notifications')
      .where({ user_id: userId, read: false })
      .count('* as count')
      .first();
    
    res.json({ count: parseInt(result.count, 10) });
  } catch (err) {
    next(err);
  }
});

router.post('/notify', async (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token || token !== `Bearer ${INTERNAL_TOKEN}`) {
    return res.status(403).json({ error: { message: 'Forbidden', code: 'FORBIDDEN' } });
  }

  const schema = z.object({
    userId: z.string().uuid().optional(),
    userIds: z.array(z.string().uuid()).optional(),
    type: z.enum(['assigned', 'status_changed', 'mentioned', 'sla_breach']),
    message: z.string(),
    incidentId: z.string().uuid().optional()
  });

  try {
    const data = schema.parse(req.body);
    const usersToNotify = data.userIds || (data.userId ? [data.userId] : []);

    if (usersToNotify.length === 0) {
      return res.status(400).json({ error: { message: 'No recipients provided' } });
    }

    const inserts = usersToNotify.map(uid => ({
      user_id: uid,
      type: data.type,
      message: data.message,
      incident_id: data.incidentId
    }));

    await db('notifications.notifications').insert(inserts);

    // Later integration: email sending logic could go here depending on NOTIFY_CHANNEL

    res.status(201).json({ success: true, count: inserts.length });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: { message: 'Validation error', details: err.errors } });
    next(err);
  }
});

module.exports = router;
