/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable("users", (table) => {
    table.increments("id");
    table.string("name").comment("用戶名稱");
    table.string("user_id").comment("用戶帳號").unique();
    table.string("username").comment("用戶帳號");
    table.string("password").comment("用戶密碼");
    table.string("day_shift").comment("班別, HH:mm-HH:mm");
    table.timestamps(true, true);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable("users");
};
