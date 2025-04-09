🔍 Semantic Search API with Hugging Face & MongoDB (AWS Lambda)

This is a lightweight and scalable semantic search backend powered by Hugging Face embeddings and MongoDB. The API allows you to store documents, generate their vector embeddings, and search semantically using cosine similarity. Deployed seamlessly on AWS Lambda.

🚀 Live Endpoints (Deployed on AWS Lambda)

- [POST] /ingest – Store a document and generate its embedding  
  👉 https://5ybwcy5d87.execute-api.ap-south-1.amazonaws.com/ingest

- [GET] /search?q=your+query – Search documents semantically  
  👉 https://5ybwcy5d87.execute-api.ap-south-1.amazonaws.com/search?q=test

- [GET] /document/:id – Get document by ID  
  👉 https://5ybwcy5d87.execute-api.ap-south-1.amazonaws.com/document/67f6cf8f537bb29b079b100d

🧠 How It Works

- Uses Hugging Face Inference API to generate embeddings via sentence-transformers/all-MiniLM-L6-v2.
- Stores text, metadata, and embedding vectors in a MongoDB collection.
- Performs cosine similarity between vectors to return the most relevant results.
- Fully deployed on AWS Lambda using serverless-http.

📦 Tech Stack

- Node.js + Express
- Hugging Face Inference Client
- MongoDB
- AWS Lambda + API Gateway

📌 API Usage Examples

➕ Ingest Document

POST /ingest  
Body:
{
  "text": "The quick brown fox jumps over the lazy dog.",
  "metadata": {
    "source": "example",
    "author": "anonymous"
  }
}

🔍 Search Documents

GET /search?q=fox

Returns the most relevant documents sorted by cosine similarity.

📄 Get Document by ID

GET /document/<document_id>

Returns the original text and its metadata.


 Author

Made by Vaibhav Sharma • thevaibhav19@gmail.com
