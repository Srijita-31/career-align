const crypto = require('crypto');

// Configuration – defaults to local embedding with fixed dimension
const EMBEDDING_PROVIDER = (process.env.EMBEDDING_PROVIDER || 'local').toLowerCase();
const EMBEDDING_DIMENSIONS = Number(process.env.EMBEDDING_DIMENSIONS || 384);

/**
 * Simple deterministic local embedding.
 * It hashes the input text with SHA‑256, expands the hash bytes to the desired length,
 * and normalises the vector to unit length. This avoids any external API calls.
 *
 * @param {string} text – input text to embed
 * @returns {number[]} embedding vector of length EMBEDDING_DIMENSIONS
 */
function createEmbedding(text) {
  if (!text) {
    throw new Error('Cannot create an embedding for empty text.');
  }
  // Clean input – collapse whitespace and trim
  const cleaned = String(text).replace(/\s+/g, ' ').trim();

  // Produce a SHA‑256 hash (64 hex chars => 32 bytes)
  const hash = crypto.createHash('sha256').update(cleaned).digest(); // Buffer of 32 bytes

  // Expand to the required dimension by repeating the hash bytes
  const values = [];
  while (values.length < EMBEDDING_DIMENSIONS) {
    for (let i = 0; i < hash.length && values.length < EMBEDDING_DIMENSIONS; i++) {
      // Convert each byte (0‑255) to a float in range [-1, 1]
      const byte = hash[i];
      const normalized = (byte / 127.5) - 1; // maps 0→-1, 255→1
      values.push(normalized);
    }
  }

  // Normalise to unit length (optional but helps similarity calculations)
  const norm = Math.sqrt(values.reduce((sum, v) => sum + v * v, 0));
  if (norm > 0) {
    for (let i = 0; i < values.length; i++) {
      values[i] = values[i] / norm;
    }
  }
  return values;
}

module.exports = {
  createEmbedding,
  EMBEDDING_PROVIDER,
  EMBEDDING_DIMENSIONS,
};
