// Update with your config settings.

/**
 * @type { Object.<string, import("knex").Knex.Config> }
 */
module.exports = {
  client: "sqlite3",
  connection: {
    filename: "./database/checkout.db",
    useNullAsDefault: true,
  },
  directory: "./migrations",
};
