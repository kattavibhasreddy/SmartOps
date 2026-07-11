const { Client } = require('pg');
const bcrypt = require('bcrypt');

const client = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'smartops_admin',
  password: process.env.DB_PASSWORD || 'smartops_password',
  database: process.env.DB_NAME || 'smartops'
});

async function seed() {
  await client.connect();
  console.log('Connected to database');

  try {
    const passwordHash = await bcrypt.hash('Passw0rd!', 10);

    const users = [
      { name: 'Admin', email: 'admin@smartops.io', role: 'admin' },
      { name: 'Manager', email: 'manager@smartops.io', role: 'manager' },
      { name: 'Responder', email: 'responder@smartops.io', role: 'responder' },
      { name: 'Viewer', email: 'viewer@smartops.io', role: 'viewer' }
    ];

    console.log('Seeding users...');
    const userIds = {};
    for (const u of users) {
      const res = await client.query(
        `INSERT INTO auth.users (name, email, password_hash, role) 
         VALUES ($1, $2, $3, $4) 
         ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role 
         RETURNING id`,
        [u.name, u.email, passwordHash, u.role]
      );
      userIds[u.role] = res.rows[0].id;
    }

    console.log('Seeding incidents...');
    const incidents = [
      { title: 'Database connection timeout', desc: 'Main cluster is refusing connections.', severity: 'P1', status: 'open', assignee: null },
      { title: 'Login page slow', desc: 'Users reporting 5s delay on login.', severity: 'P3', status: 'acknowledged', assignee: userIds['responder'] },
      { title: 'Payment gateway failing', desc: 'Stripe webhook 500 errors.', severity: 'P1', status: 'in_progress', assignee: userIds['responder'] },
      { title: 'Missing CSS on dashboard', desc: 'Stylesheet returning 404.', severity: 'P4', status: 'resolved', assignee: userIds['manager'] },
      { title: 'Redis memory full', desc: 'Cache eviction not working.', severity: 'P2', status: 'closed', assignee: userIds['admin'] },
      { title: 'API rate limit exceeded', desc: 'Service-to-service calls failing.', severity: 'P2', status: 'open', assignee: null },
      { title: 'New user registration failing', desc: 'Email verification link broken.', severity: 'P3', status: 'in_progress', assignee: userIds['responder'] },
      { title: 'Search functionality broken', desc: 'Elasticsearch cluster red.', severity: 'P1', status: 'acknowledged', assignee: userIds['manager'] }
    ];

    for (const inc of incidents) {
      const res = await client.query(
        `INSERT INTO incidents.incidents (title, description, severity, status, reporter_id, assignee_id) 
         VALUES ($1, $2, $3, $4, $5, $6) 
         RETURNING id`,
        [inc.title, inc.desc, inc.severity, inc.status, userIds['viewer'], inc.assignee]
      );
      
      const incId = res.rows[0].id;
      
      await client.query(
        `INSERT INTO incidents.incident_history (incident_id, action, performed_by, details) 
         VALUES ($1, $2, $3, $4)`,
        [incId, 'created', userIds['viewer'], JSON.stringify({ title: inc.title })]
      );

      if (inc.assignee) {
        await client.query(
          `INSERT INTO incidents.incident_history (incident_id, action, performed_by, details) 
           VALUES ($1, $2, $3, $4)`,
          [incId, 'assigned', userIds['manager'], JSON.stringify({ assigneeId: inc.assignee })]
        );
      }
    }

    console.log('Seeding complete.');
  } catch (err) {
    console.error('Seeding error:', err);
  } finally {
    await client.end();
  }
}

seed();
