const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { z } = require('zod');
const db = require('./db');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'internal_secret_token_123';

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['admin', 'manager', 'responder', 'viewer']).optional()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'auth-service' });
});

router.post('/register', async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    const existingUser = await db('auth.users').where({ email: data.email }).first();
    if (existingUser) {
      return res.status(400).json({ error: { message: 'Email already exists', code: 'EMAIL_EXISTS' } });
    }

    const password_hash = await bcrypt.hash(data.password, 10);
    const role = data.role || 'viewer';

    const [user] = await db('auth.users').insert({
      name: data.name,
      email: data.email,
      password_hash,
      role
    }).returning(['id', 'name', 'email', 'role']);

    res.status(201).json(user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: { message: 'Validation error', code: 'VALIDATION_ERROR', details: error.errors } });
    }
    next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const user = await db('auth.users').where({ email: data.email }).first();
    if (!user) {
      return res.status(401).json({ error: { message: 'Invalid credentials', code: 'INVALID_CREDENTIALS' } });
    }

    const isValid = await bcrypt.compare(data.password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: { message: 'Invalid credentials', code: 'INVALID_CREDENTIALS' } });
    }

    const accessToken = jwt.sign({ sub: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '15m' });
    
    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    const token_hash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
    
    const expires_at = new Date();
    expires_at.setDate(expires_at.getDate() + 7);

    await db('auth.refresh_tokens').insert({
      user_id: user.id,
      token_hash,
      expires_at
    });

    res.cookie('refreshToken', rawRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      accessToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: { message: 'Validation error', code: 'VALIDATION_ERROR', details: error.errors } });
    }
    next(error);
  }
});

router.post('/refresh', async (req, res, next) => {
  try {
    // In Express, parsing cookies normally requires cookie-parser, but we can do a simple header parse here, or we should add cookie-parser.
    // Let's add simple parsing
    const cookieHeader = req.headers.cookie || '';
    const match = cookieHeader.match(/refreshToken=([^;]+)/);
    const rawRefreshToken = match ? match[1] : null;

    if (!rawRefreshToken) {
      return res.status(401).json({ error: { message: 'No refresh token provided', code: 'NO_TOKEN' } });
    }

    const token_hash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
    const dbToken = await db('auth.refresh_tokens').where({ token_hash, revoked: false }).first();

    if (!dbToken || new Date() > dbToken.expires_at) {
      return res.status(401).json({ error: { message: 'Invalid or expired refresh token', code: 'INVALID_TOKEN' } });
    }

    const user = await db('auth.users').where({ id: dbToken.user_id }).first();
    if (!user) {
      return res.status(401).json({ error: { message: 'User not found', code: 'USER_NOT_FOUND' } });
    }

    const accessToken = jwt.sign({ sub: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '15m' });

    res.json({ accessToken });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', async (req, res, next) => {
  try {
    const cookieHeader = req.headers.cookie || '';
    const match = cookieHeader.match(/refreshToken=([^;]+)/);
    const rawRefreshToken = match ? match[1] : null;

    if (rawRefreshToken) {
      const token_hash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
      await db('auth.refresh_tokens').where({ token_hash }).update({ revoked: true });
    }

    res.clearCookie('refreshToken');
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.get('/me', async (req, res, next) => {
  // Using x-user-id from gateway
  const userId = req.headers['x-user-id'];
  if (!userId) {
    return res.status(401).json({ error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } });
  }
  try {
    const user = await db('auth.users').where({ id: userId }).first();
    if (!user) {
      return res.status(404).json({ error: { message: 'User not found', code: 'NOT_FOUND' } });
    }
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
  } catch (error) {
    next(error);
  }
});

router.get('/users', async (req, res, next) => {
  const internalToken = req.headers['authorization'];
  if (internalToken && internalToken === `Bearer ${INTERNAL_TOKEN}`) {
    try {
      const users = await db('auth.users').select('id', 'name', 'email', 'role');
      return res.json(users);
    } catch(err) {
      return next(err);
    }
  }

  const userRole = req.headers['x-user-role'];
  if (!userRole || !['admin', 'manager'].includes(userRole)) {
    return res.status(403).json({ error: { message: 'Forbidden', code: 'FORBIDDEN' } });
  }
  
  try {
    const users = await db('auth.users').select('id', 'name', 'email', 'role');
    res.json(users);
  } catch (error) {
    next(error);
  }
});

router.post('/users', async (req, res, next) => {
  const userRole = req.headers['x-user-role'];
  if (userRole !== 'admin') {
    return res.status(403).json({ error: { message: 'Forbidden', code: 'FORBIDDEN' } });
  }
  try {
    const data = registerSchema.parse(req.body);
    const existingUser = await db('auth.users').where({ email: data.email }).first();
    if (existingUser) {
      return res.status(400).json({ error: { message: 'Email already exists', code: 'EMAIL_EXISTS' } });
    }

    const password_hash = await bcrypt.hash(data.password, 10);
    const role = data.role || 'viewer';

    const [user] = await db('auth.users').insert({
      name: data.name,
      email: data.email,
      password_hash,
      role
    }).returning(['id', 'name', 'email', 'role']);

    res.status(201).json(user);
  } catch (error) {
    next(error);
  }
});

router.patch('/users/:id/role', async (req, res, next) => {
  const userRole = req.headers['x-user-role'];
  if (userRole !== 'admin') {
    return res.status(403).json({ error: { message: 'Forbidden', code: 'FORBIDDEN' } });
  }
  
  const roleSchema = z.object({
    role: z.enum(['admin', 'manager', 'responder', 'viewer'])
  });

  try {
    const data = roleSchema.parse(req.body);
    const [user] = await db('auth.users').where({ id: req.params.id }).update({ role: data.role }).returning(['id', 'name', 'email', 'role']);
    if (!user) {
       return res.status(404).json({ error: { message: 'User not found', code: 'NOT_FOUND' } });
    }
    res.json(user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: { message: 'Validation error', code: 'VALIDATION_ERROR', details: error.errors } });
    }
    next(error);
  }
});

module.exports = router;
