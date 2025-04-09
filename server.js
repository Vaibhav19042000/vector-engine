const { InferenceClient } = require("@huggingface/inference");
const express = require("express");
const { connect } = require("./db");
const app = express();
const serverless = require('serverless-http')
const {ObjectId} = require('mongodb')

app.use((req, res, next) => {
  const contentType = req.headers["content-type"] || "";

  if (contentType.includes("application/json")) {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try {
        req.body = JSON.parse(data);
        next();
      } catch (e) {
        console.error("JSON parse error:", e);
        res.status(400).send("Invalid JSON");
      }
    });
  } else {
    express.json()(req, res, next);
  }
});

const client = new InferenceClient(process.env.HF_API_KEY);

let db;

async function initDb() {
  if(!db) db = await connect();
}

// get bert embedding for text
async function getEmbedding(text) {
  try {
    const response = await client.featureExtraction({
      model: "sentence-transformers/all-MiniLM-L6-v2",
      inputs: text,
    });

    // Log the structure to understand what we're getting
    console.log(
      "Embedding response structure:",
      JSON.stringify(response).substring(0, 100) + "..."
    );

    // The response structure from HF might be different than expected
    // Return the actual embedding vector
    return Array.isArray(response) ? response : response.embeddings[0];
  } catch (error) {
    console.error("Error getting embedding:", error);
    throw error;
  }
}

// Calculate cosine similarity between two vectors
function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

app.post("/ingest", async (req, res) => {
  console.log("POST /ingest received");
  console.log("Request headers:", JSON.stringify(req.headers));
  console.log("Request body type:", typeof req.body);
  console.log("Request body:", JSON.stringify(req.body).substring(0, 300));
    console.log("Parsed body:", req.body); 

  const { text, metadata } = req.body || {};
  if (!text) {
    console.error(
      "POST /ingest error: No text provided in body:",
      JSON.stringify(req.body)
    );
    return res.status(400).send("No text provided");
  }

  try {
    console.log(`Ingesting document: "${text.substring(0, 50)}..."`);
    const embedding = await getEmbedding(text);

    // Verify we have a proper embedding vector
    if (!Array.isArray(embedding) || embedding.length === 0) {
      console.error("Invalid embedding received:", embedding);
      return res.status(500).send("Failed to generate embedding");
    }

    console.log(`Generated embedding with length: ${embedding.length}`);

    // Store document with metadata and timestamp
    const result = await db.collection("documents").insertOne({
      text,
      embedding,
      metadata: metadata || {},
      createdAt: new Date(),
    });

    console.log(`Document stored with ID: ${result.insertedId}`);

    res.send({
      status: "Document stored successfully",
      id: result.insertedId,
      embeddingLength: embedding.length,
    });
  } catch (error) {
    console.error("Ingestion error:", error);
    res.status(500).send("Failed to store document");
  }
});
app.get("/search", async (req, res) => {
  const query = req.query.q;
  const limit = parseInt(req.query.limit) || 10; // Default 10 results
  const page = parseInt(req.query.page) || 1; // Default page 1
  const skip = (page - 1) * limit;

  if (!query) return res.status(400).send("No query provided");

  try {
    console.log(`Processing search for query: "${query}"`);
    const queryEmbedding = await getEmbedding(query);

    // Verify we have a proper embedding vector
    if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
      console.error("Invalid query embedding received:", queryEmbedding);
      return res.status(500).send("Failed to generate query embedding");
    }

    console.log(`Query embedding generated, length: ${queryEmbedding.length}`);

    const documents = await db.collection("documents").find().toArray();
    console.log(`Found ${documents.length} documents to compare`);

    // Calculate similarity for each document with debugging
    const results = documents.map((doc) => {
      // Check if document has a valid embedding
      if (
        !doc.embedding ||
        !Array.isArray(doc.embedding) ||
        doc.embedding.length === 0
      ) {
        console.warn(
          `Document ${doc._id} has invalid embedding:`,
          doc.embedding
        );
        return {
          id: doc._id,
          text: doc.text,
          metadata: doc.metadata || {},
          score: 0,
          warning: "Invalid embedding",
        };
      }

      // Verify vector dimensions match
      if (doc.embedding.length !== queryEmbedding.length) {
        console.warn(
          `Dimension mismatch for doc ${doc._id}: ${doc.embedding.length} vs query: ${queryEmbedding.length}`
        );
        return {
          id: doc._id,
          text: doc.text,
          metadata: doc.metadata || {},
          score: 0,
          warning: "Dimension mismatch",
        };
      }

      const score = cosineSimilarity(queryEmbedding, doc.embedding);

      return {
        id: doc._id,
        text: doc.text,
        metadata: doc.metadata || {},
        score,
      };
    });

    // Sort by similarity score (descending)
    const sortedResults = results.sort((a, b) => b.score - a.score);

    // Apply pagination
    const paginatedResults = sortedResults.slice(skip, skip + limit);

    res.send({
      results: paginatedResults,
      pagination: {
        total: sortedResults.length,
        page,
        limit,
        pages: Math.ceil(sortedResults.length / limit),
      },
    });
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).send("Search failed");
  }
});
// Get document by ID
app.get("/document/:id", async (req, res) => {
  try {
    const document = await db.collection("documents").findOne({
      _id: new ObjectId(req.params.id),
    });

    if (!document) {
      return res.status(404).send("Document not found");
    }

    res.send({
      id: document._id,
      text: document.text,
      metadata: document.metadata,
    });
  } catch (error) {
    console.error("Get document error:", error);
    res.status(500).send("Failed to retrieve document");
  }
});


const lamdahandler = serverless(app);

module.exports.handler = async(event,context)=>{
  // Handle API Gateway format
  console.log("Raw event:", JSON.stringify(event).substring(0, 500));

  // Pre-process the event body if needed
  if (event.body) {
    // If body is a string, try to parse it
    if (typeof event.body === "string") {
      try {
        event.body = JSON.parse(event.body);
        console.log(
          "Parsed string body:",
          JSON.stringify(event.body).substring(0, 200)
        );
      } catch (e) {
        // If it's not valid JSON, keep it as a string
        console.log("Body is not valid JSON, keeping as string");
      }
    }
  }

  try {
    await initDb();
    return lamdahandler(event, context);
  } catch (error) {
    console.error("lamda handler error: ", error);
    return {
      statusCode: 500,
      body: "Internal Server Error",
    };
  }
}