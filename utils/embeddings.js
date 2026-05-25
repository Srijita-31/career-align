const OpenAI = require("openai");

const EMBEDDING_PROVIDER = (process.env.EMBEDDING_PROVIDER || "local").toLowerCase();
const LOCAL_EMBEDDING_MODEL = process.env.LOCAL_EMBEDDING_MODEL || "Xenova/all-MiniLM-L6-v2";
const OPENAI_EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
const EMBEDDING_MODEL = EMBEDDING_PROVIDER === "openai" ? OPENAI_EMBEDDING_MODEL : LOCAL_EMBEDDING_MODEL;
const EMBEDDING_DIMENSIONS = Number(process.env.EMBEDDING_DIMENSIONS || (EMBEDDING_PROVIDER === "openai" ? 1536 : 384));

let openAiClient;
let localExtractorPromise;

const getOpenAiClient = () => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required when EMBEDDING_PROVIDER=openai.");
  }
  if (!openAiClient) {
    openAiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL || undefined,
    });
  }
  return openAiClient;
};

const getLocalExtractor = async () => {
  if (!localExtractorPromise) {
    localExtractorPromise = import("@xenova/transformers")
      .then(({ pipeline }) => pipeline("feature-extraction", LOCAL_EMBEDDING_MODEL));
  }
  return localExtractorPromise;
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

  if (EMBEDDING_PROVIDER === "openai") {
    const response = await getOpenAiClient().embeddings.create({
      model: OPENAI_EMBEDDING_MODEL,
      input,
      dimensions: EMBEDDING_DIMENSIONS,
    });

    return response.data[0].embedding;
  }

  const extractor = await getLocalExtractor();
  const output = await extractor(input, { pooling: "mean", normalize: true });
  const embedding = Array.from(output.data);
  if (embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`Embedding dimension mismatch: expected ${EMBEDDING_DIMENSIONS}, received ${embedding.length}.`);
  }

  return embedding;
};

module.exports = { createEmbedding, EMBEDDING_PROVIDER, EMBEDDING_MODEL, EMBEDDING_DIMENSIONS };
