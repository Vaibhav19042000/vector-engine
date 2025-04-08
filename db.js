require("dotenv").config();
const { MongoClient } = require("mongodb");

const url = process.env.MONGODB_URL;
console.log("MONGODB_URL1 ", process.env.MONGODB_URL);
const client = new MongoClient(url);

async function connect() {
  try {
    console.log('MONGODB_URL2 ',process.env.MONGODB_URL);
    await client.connect();
    console.log("Connected to mongodb atlas");
    return client.db("vector_db");
  } catch (error) {
    console.error("Connection error: ", error);
    process.exit(1);
  }
}

module.exports = { connect,client };
