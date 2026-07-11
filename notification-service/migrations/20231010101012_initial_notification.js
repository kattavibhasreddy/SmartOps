exports.up = function(knex) {
  return knex.schema.withSchema('notifications').createTable('notifications', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable();
    table.text('type').notNullable();
    table.text('message').notNullable();
    table.uuid('incident_id');
    table.boolean('read').defaultTo(false);
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = function(knex) {
  return knex.schema.withSchema('notifications').dropTableIfExists('notifications');
};
