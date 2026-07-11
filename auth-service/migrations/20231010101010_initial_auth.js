exports.up = function(knex) {
  return knex.schema.withSchema('auth').createTable('users', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.text('name').notNullable();
    table.text('email').unique().notNullable();
    table.text('password_hash').notNullable();
    table.text('role').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  })
  .withSchema('auth').createTable('refresh_tokens', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').references('id').inTable('auth.users').onDelete('CASCADE');
    table.text('token_hash').notNullable();
    table.timestamp('expires_at').notNullable();
    table.boolean('revoked').defaultTo(false);
  });
};

exports.down = function(knex) {
  return knex.schema.withSchema('auth').dropTableIfExists('refresh_tokens')
    .withSchema('auth').dropTableIfExists('users');
};
