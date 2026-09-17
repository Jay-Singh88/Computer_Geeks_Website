const { neon } = require('@neondatabase/serverless');

let client;
function sql(strings, ...values) {
  if (!client) client = neon(process.env.DATABASE_URL || process.env.POSTGRES_URL, { fullResults: true });
  return client(strings, ...values);
}

module.exports = { sql };
