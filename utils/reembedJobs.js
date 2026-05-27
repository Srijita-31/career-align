require('dotenv').config({ quiet: true });

const { closePool, countStaleJobEmbeddings, reembedStaleJobEmbeddings } = require('./db');

const main = async () => {
  const staleCount = await countStaleJobEmbeddings();
  if (!staleCount) {
    console.log('[DB] No stale job embeddings found.');
    return;
  }

  console.log(`[DB] Re-embedding ${staleCount} stale job embeddings...`);
  const result = await reembedStaleJobEmbeddings({
    batchSize: Number(process.env.REEMBED_BATCH_SIZE) || 50,
  });
  console.log(`[DB] Re-embedded ${result.updated} jobs using embedding text version ${result.embeddingTextVersion}.`);
};

main()
  .catch((error) => {
    console.error('[DB] Re-embedding failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool().catch(() => undefined);
  });
