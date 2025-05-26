// business_logic.js

/**
 * Entry step: passes through raw data
 * @param {object} ctx
 * @returns {object}
 */
function entry(ctx) {
  return ctx;
}

/**
 * Increment value
 * @param {object} ctx
 * @returns {object}
 */
function increment(ctx) {
  ctx.value = (ctx.value || 0) + 1;
  return ctx;
}

/**
 * Double value
 * @param {object} ctx
 * @returns {object}
 */
function double(ctx) {
  ctx.value = ctx.value * 2;
  return ctx;
}

/**
 * Respond: shape output
 * @param {object} ctx
 * @returns {object}
 */
function respond(ctx) {
  return { result: ctx.value };
}

module.exports = { entry, increment, double, respond };
