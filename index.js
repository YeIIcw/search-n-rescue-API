const express = require("express");
const bodyParser = require("body-parser");
const { MongoClient } = require('mongodb');
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();

const app = express();
const port = 3001;

app.use(bodyParser.json());
app.use(cors());

const uri = "mongodb+srv://wangadam019:123@cluster0.csarsun.mongodb.net/?retryWrites=true&w=majority"; // Replace with your MongoDB URI
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

const sendSms = require('./send.js');    
    const config = {  
           domain: '6gy1qe.api.infobip.com', 
            apiKey: 'fec1274dfc9bfa8da89a148fd5d4ead3-97afe641-bf55-43fe-a5b7-742438482619'
    };


app.post("/", async (req, res) => {
  try {
    const postData = req.body;
    console.log("Received POST request:", postData);

    // Connect to MongoDB
    await client.connect();

    const database = client.db('rescue'); // Replace with your database name
    const collection = database.collection('person'); // Replace with your collection name

    // Insert the data into the collection
    await collection.insertOne(postData);

    // Send an SMS message using Infobip
    const smsMessage = `Require for AID - Class: ${postData.className}, Time: ${postData.time}%, Location: ${postData.location}`;
    await sendSms(config,'+16473332027', smsMessage).then(result => console.log(result));


    // Send a response back to the client
    res.send("POST request received, data inserted, and SMS sent successfully");
  } catch (error) {
    console.error('Error handling POST request:', error);
    res.status(500).send('Internal Server Error');
  } finally {
    // Close the MongoDB connection
    await client.close();
  }
});

// New endpoint to fetch data from MongoDB
app.get("/data", async (req, res) => {
  try {
    // Connect to MongoDB
    await client.connect();

    const database = client.db('rescue'); // Replace with your database name
    const collection = database.collection('person'); // Replace with your collection name

    // Fetch data from MongoDB
    const data = await collection.find({}).toArray();

    // Send the fetched data to the client
    res.json(data);
  } catch (error) {
    console.error('Error fetching data from MongoDB:', error);
    res.status(500).send('Internal Server Error');
  } finally {
    // Close the MongoDB connection
    await client.close();
  }
});


const server = app.listen(port, () => {
  console.log(`Server is running on ${port}`);
});
