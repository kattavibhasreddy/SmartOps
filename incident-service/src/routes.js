const express = require('express');
const { z } = require('zod');
const axios = require('axios');
const db = require('./db');
const logger = require('./logger');

const router = express.Router();

const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'internal_secret_token_123';
const NOTIFICATION_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:4003';
const AUTH_URL = process.env.AUTH_SERVICE_URL || 'http://auth-service:4001';

const sendNotification = async (payload) => {
  try {
    await axios.post(`${NOTIFICATION_URL}/notify`, payload, {
      headers: { 'Authorization': `Bearer ${INTERNAL_TOKEN}` }
    });
  } catch (err) {
    logger.error('Failed to send notification', err.message);
  }
};

const getInternalUsers = async () => {
  try {
    const res = await axios.get(`${AUTH_URL}/users`, {
      headers: { 'Authorization': `Bearer ${INTERNAL_TOKEN}` }
    });
    return res.data;
  } catch (err) {
    logger.error('Failed to get internal users', err.message);
    return [];
  }
};

router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'incident-service' });
});

router.get('/', async (req, res, next) => {
  try {
    const { status, severity, assigneeId, page = 1, pageSize = 20 } = req.query;
    let query = db('incidents.incidents').orderBy('created_at', 'desc');

    if (status) query = query.where({ status });
    if (severity) query = query.where({ severity });
    if (assigneeId) query = query.where({ assignee_id: assigneeId });

    const limit = parseInt(pageSize, 10);
    const offset = (parseInt(page, 10) - 1) * limit;

    const incidents = await query.limit(limit).offset(offset);
    res.json(incidents);
  } catch (err) {
    next(err);
  }
});

router.get('/stats', async (req, res, next) => {
  const role = req.headers['x-user-role'];
  if (!['admin', 'manager'].includes(role)) {
    return res.status(403).json({ error: { message: 'Forbidden', code: 'FORBIDDEN' } });
  }

  try {
    const byStatus = await db('incidents.incidents').select('status').count('* as count').groupBy('status');
    const bySeverity = await db('incidents.incidents').select('severity').count('* as count').groupBy('severity');
    
    // Average time to resolution for incidents resolved in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const resolvedTime = await db('incidents.incidents')
      .where('status', 'resolved')
      .andWhere('resolved_at', '>=', thirtyDaysAgo)
      .select(db.raw('AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600) as avg_resolution_hours'))
      .first();

    res.json({
      byStatus,
      bySeverity,
      avgResolutionHours: resolvedTime?.avg_resolution_hours || 0
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const incident = await db('incidents.incidents').where({ id: req.params.id }).first();
    if (!incident) return res.status(404).json({ error: { message: 'Incident not found' } });
    
    const comments = await db('incidents.comments').where({ incident_id: req.params.id }).orderBy('created_at', 'asc');
    const history = await db('incidents.incident_history').where({ incident_id: req.params.id }).orderBy('created_at', 'desc');

    res.json({ ...incident, comments, history });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  const role = req.headers['x-user-role'];
  const userId = req.headers['x-user-id'];
  if (role === 'viewer') return res.status(403).json({ error: { message: 'Forbidden', code: 'FORBIDDEN' } });

  const schema = z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    severity: z.enum(['P1', 'P2', 'P3', 'P4'])
  });

  try {
    const data = schema.parse(req.body);
    const [incident] = await db('incidents.incidents').insert({
      title: data.title,
      description: data.description,
      severity: data.severity,
      status: 'open',
      reporter_id: userId
    }).returning('*');

    await db('incidents.incident_history').insert({
      incident_id: incident.id,
      action: 'created',
      performed_by: userId,
      details: { title: data.title }
    });

    if (['P1', 'P2'].includes(data.severity)) {
      const users = await getInternalUsers();
      const managerAdmins = users.filter(u => ['manager', 'admin'].includes(u.role)).map(u => u.id);
      if (managerAdmins.length > 0) {
        await sendNotification({
          userIds: managerAdmins,
          type: 'status_changed',
          message: `New ${data.severity} incident created: ${data.title}`,
          incidentId: incident.id
        });
      }
    }

    res.status(201).json(incident);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: { message: 'Validation error', details: err.errors } });
    next(err);
  }
});

router.patch('/:id/assign', async (req, res, next) => {
  const role = req.headers['x-user-role'];
  const userId = req.headers['x-user-id'];
  if (!['admin', 'manager'].includes(role)) return res.status(403).json({ error: { message: 'Forbidden', code: 'FORBIDDEN' } });

  const schema = z.object({ assigneeId: z.string().uuid() });
  try {
    const { assigneeId } = schema.parse(req.body);
    
    // Validate assigneeId via internal API
    const users = await getInternalUsers();
    if (!users.find(u => u.id === assigneeId)) {
      return res.status(400).json({ error: { message: 'Assignee not found', code: 'INVALID_ASSIGNEE' } });
    }

    const [incident] = await db('incidents.incidents').where({ id: req.params.id }).update({ assignee_id: assigneeId, updated_at: db.fn.now() }).returning('*');
    if (!incident) return res.status(404).json({ error: { message: 'Not found' } });

    await db('incidents.incident_history').insert({
      incident_id: incident.id,
      action: 'assigned',
      performed_by: userId,
      details: { assigneeId }
    });

    await sendNotification({
      userId: assigneeId,
      type: 'assigned',
      message: `You have been assigned to incident: ${incident.title}`,
      incidentId: incident.id
    });

    res.json(incident);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: { message: 'Validation error', details: err.errors } });
    next(err);
  }
});

router.patch('/:id/status', async (req, res, next) => {
  const role = req.headers['x-user-role'];
  const userId = req.headers['x-user-id'];

  const schema = z.object({ status: z.enum(['open', 'acknowledged', 'in_progress', 'resolved', 'closed']) });
  try {
    const { status } = schema.parse(req.body);
    const current = await db('incidents.incidents').where({ id: req.params.id }).first();
    if (!current) return res.status(404).json({ error: { message: 'Not found' } });

    if (role === 'responder' && current.assignee_id !== userId) {
      return res.status(403).json({ error: { message: 'Responder can only change status of assigned incidents', code: 'FORBIDDEN' } });
    }
    if (role === 'viewer') return res.status(403).json({ error: { message: 'Forbidden', code: 'FORBIDDEN' } });

    const validTransitions = {
      'open': ['acknowledged', 'in_progress'],
      'acknowledged': ['in_progress', 'resolved'],
      'in_progress': ['resolved'],
      'resolved': ['closed', 'in_progress'],
      'closed': []
    };

    if (!validTransitions[current.status].includes(status)) {
      return res.status(400).json({ error: { message: 'Invalid status transition', code: 'INVALID_TRANSITION' } });
    }

    const updateData = { status, updated_at: db.fn.now() };
    if (status === 'resolved') updateData.resolved_at = db.fn.now();

    const [incident] = await db('incidents.incidents').where({ id: req.params.id }).update(updateData).returning('*');

    await db('incidents.incident_history').insert({
      incident_id: incident.id,
      action: 'status_changed',
      performed_by: userId,
      details: { from: current.status, to: status }
    });

    const notifyUsers = [];
    if (incident.reporter_id && incident.reporter_id !== userId) notifyUsers.push(incident.reporter_id);
    if (incident.assignee_id && incident.assignee_id !== userId) notifyUsers.push(incident.assignee_id);

    if (notifyUsers.length > 0) {
      await sendNotification({
        userIds: notifyUsers,
        type: 'status_changed',
        message: `Incident status changed to ${status}: ${incident.title}`,
        incidentId: incident.id
      });
    }

    res.json(incident);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: { message: 'Validation error', details: err.errors } });
    next(err);
  }
});

router.post('/:id/comments', async (req, res, next) => {
  const userId = req.headers['x-user-id'];
  const schema = z.object({ body: z.string().min(1) });
  
  try {
    const { body } = schema.parse(req.body);
    const incident = await db('incidents.incidents').where({ id: req.params.id }).first();
    if (!incident) return res.status(404).json({ error: { message: 'Not found' } });

    const [comment] = await db('incidents.comments').insert({
      incident_id: incident.id,
      author_id: userId,
      body
    }).returning('*');

    await db('incidents.incident_history').insert({
      incident_id: incident.id,
      action: 'commented',
      performed_by: userId,
      details: {}
    });

    const notifyUsers = [];
    if (incident.reporter_id && incident.reporter_id !== userId) notifyUsers.push(incident.reporter_id);
    if (incident.assignee_id && incident.assignee_id !== userId) notifyUsers.push(incident.assignee_id);

    if (notifyUsers.length > 0) {
      await sendNotification({
        userIds: notifyUsers,
        type: 'mentioned',
        message: `New comment on incident: ${incident.title}`,
        incidentId: incident.id
      });
    }

    res.status(201).json(comment);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: { message: 'Validation error', details: err.errors } });
    next(err);
  }
});

router.get('/:id/history', async (req, res, next) => {
  try {
    const history = await db('incidents.incident_history').where({ incident_id: req.params.id }).orderBy('created_at', 'desc');
    res.json(history);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
