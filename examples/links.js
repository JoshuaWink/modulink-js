// links.js
// --------

// (1) Plain "link" functions: async (ctx) => ctx
export async function validateInputLink(ctx) {
  if (!ctx.payload || !ctx.payload.email) {
    throw new Error('Missing email');
  }
  ctx.validated = { email: ctx.payload.email.trim() };
  return ctx;
}

export async function createUserLink(ctx) {
  const { email } = ctx.validated;
  // Imagine: const newUser = await db.users.insert({ email });
  ctx.newUser = { id: 'abc123', email };
  return ctx;
}

export async function sendWelcomeEmailLink(ctx) {
  // Imagine: await emailClient.send({ to: ctx.newUser.email, template: 'welcome' });
  ctx.emailSent = true;
  return ctx;
}

// (2) Chain‐level middleware example: async (ctx, next) => { … }
export function timingMiddleware(label) {
  return async function timing(ctx, next) {
    const start = Date.now();
    await next();
    const elapsed = Date.now() - start;
    ctx.timings = ctx.timings || {};
    ctx.timings[label] = elapsed;
  };
}

// Additional example links for cleanup chain
export async function findOldUsersLink(ctx) {
  // Imagine: const oldUsers = await db.users.findOlderThan(30);
  ctx.oldUsers = [
    { id: 'user1', email: 'old1@example.com', createdAt: new Date('2020-01-01') },
    { id: 'user2', email: 'old2@example.com', createdAt: new Date('2020-01-02') }
  ];
  return ctx;
}

export async function deleteOldUsersLink(ctx) {
  const { oldUsers } = ctx;
  // Imagine: await db.users.deleteMany(oldUsers.map(u => u.id));
  ctx.deletedCount = oldUsers.length;
  return ctx;
}

// CLI example links
export async function readDataFileLink(ctx) {
  const { filename } = ctx.cliArgs || {};
  if (!filename) {
    throw new Error('Missing filename argument');
  }
  // Imagine: const data = await fs.readFile(filename);
  ctx.importData = { filename, records: 100 };
  return ctx;
}

export async function processDataLink(ctx) {
  const { importData } = ctx;
  // Imagine: process the data
  ctx.processedRecords = importData.records;
  return ctx;
}

export async function saveDataLink(ctx) {
  const { processedRecords } = ctx;
  // Imagine: await db.records.insertMany(processedRecords);
  ctx.savedCount = processedRecords;
  return ctx;
}