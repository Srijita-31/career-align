const OpenAI = require("openai");

const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;

let client;

const getClient = () => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required to create embeddings.");
  }
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL || undefined,
    });
  }
  return client;
};

const cleanInput = (text) =>
  String(text || "")
    .replace(/\s+/g, " ")
    .trim();

const createEmbedding = async (text) => {
  const input = cleanInput(text);
  if (!input) {
    throw new Error("Cannot create an embedding for empty text.");
  }

  const response = await getClient().embeddings.create({
    model: EMBEDDING_MODEL,
    input,
    dimensions: EMBEDDING_DIMENSIONS,
  });

  return response.data[0].embedding;
};

module.exports = { createEmbedding, EMBEDDING_MODEL, EMBEDDING_DIMENSIONS };
