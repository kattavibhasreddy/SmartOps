exports.up = function(knex) {
  return knex.schema.withSchema('incidents').createTable('incidents', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.text('title').notNullable();
    table.text('description');
    table.text('severity').notNullable();
    table.text('status').notNullable().defaultTo('open');
    table.uuid('reporter_id');
    table.uuid('assignee_id');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.timestamp('resolved_at');
  })
  .withSchema('incidents').createTable('incident_history', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('incident_id').references('id').inTable('incidents.incidents').onDelete('CASCADE');
    table.text('action');
    table.uuid('performed_by');
    table.jsonb('details');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  })
  .withSchema('incidents').createTable('comments', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('incident_id').references('id').inTable('incidents.incidents').onDelete('CASCADE');
    table.uuid('author_id');
    table.text('body');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = function(knex) {
  return knex.schema.withSchema('incidents').dropTableIfExists('comments')
    .withSchema('incidents').dropTableIfExists('incident_history')
    .withSchema('incidents').dropTableIfExists('incidents');
};
