const express = require("express");
const bodyParser = require("body-parser");
const { MongoClient } = require('mongodb');
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();
const session = require("express-session");
const { Configuration, OpenAIApi } = require("openai");
const twilio = require("twilio");

const app = express();
const port = 3001;

app.use(bodyParser.json());
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: "dispatchBot",
    resave: false,
    saveUninitialized: true,
    cookie: {},
  })
);

const uri = "mongodb+srv://wangadam019:123@cluster0.csarsun.mongodb.net/?retryWrites=true&w=majority"; // Replace with your MongoDB URI
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

const server = app.listen(port, () => {
    console.log(`Server is running on ${port}`);
  });
  
  const io = require("socket.io")(server, {
      cors: {
        origin: "http://localhost:3001",
        methods: ["GET", "POST"],
      },
    });
    
    io.on("connection", (socket) => {
      console.log("a user connected");
    
      socket.on("disconnect", () => {
        console.log("user disconnected");
      });
    });

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
    const smsMessage = `🚑Request for AID!\nDetected: ${postData.className}\n🕛Time: ${postData.time}\n🌎Location: ${postData.location.lat},${postData.location.long}`;
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

// configuring open ai
const configuration = new Configuration({
    apiKey: "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",
});
  
  
  const openai = new OpenAIApi(configuration);
  
  // defining the global variables that will be utilized in various routes
  let convo;
  let count;
  let hangUp;
  let redo;
  let emergency;
  let callerName;
  let location;
  let number;
  let id;
  
  // transcribe endpoints handles twilio calls (initializes call, and calls /respond enpoint for responce)
  app.post("/transcribe", async (req, res) => {
    const twiml = new twilio.twiml.VoiceResponse();
  
    if (!req.session.init) {
      twiml.say(
        { voice: "Polly.Matthew-Neural" },
        "Safe Search. What is your emergency?"
      );
  
      convo += "Dispatcher: 911, what is your emergency?";
      id = Math.floor(Math.random() * 100) * Math.floor(Math.random() * 100);
      req.session.init = true;
      hangUp = false;
      redo = [0, 0, 0];
      count = 1;
      convo = "";
      emergency = "undefined";
      callerName = "undefined";
      location = "undefined";
      number = "undefined";
    }
  
    // Listen for user input and pass it to the /respond endpoint
    twiml.gather({
      enhanced: "false",
      speechTimeout: "auto",
      speechModel: "phone_call",
      input: "speech",
      action: `/respond`,
    });
  
    //  Returning the TwiML response
    res.set("Content-Type", "text/xml");
    res.send(twiml.toString());
  });
  
  // respond endpoint handles responce generation and call termination
  app.post("/respond", async (req, res) => {
    const twiml = new twilio.twiml.VoiceResponse();
    const voiceInput = req.body.SpeechResult;
    convo += `\nCaller: ${voiceInput}\nDispatcher: `;
  
    let aiResponse = await generateAIResponse(req);
    twiml.say({ voice: "Polly.Matthew-Neural" }, aiResponse);
  
    if (hangUp) {
      twiml.hangup();
      emergency = req.session.emergency;
      callerName = req.session.name;
      location = req.session.location;
      number = req.session.number;
      console.log("post hangup 2");
  
      req.session.emergency = null;
      req.session.name = null;
      req.session.location = null;
      req.session.number = null;
      req.session.init = null;
    }
  
    io.emit("call progress event", {
      inProgress: hangUp ? false : true,
      emergency: emergency,
      name: callerName,
      location: location,
      number: number,
      transcript: convo,
      id: id,
    });
  
    twiml.redirect({ method: "POST" }, `/transcribe`);
    res.set("Content-Type", "text/xml");
    res.send(twiml.toString());
});
  
  // generateAIResponce generates the next dispatcher line
async function generateAIResponse(req) {
    console.log(convo);
    if (!req.session.emergency) {
      const response = await openai.createCompletion({
        model: "text-davinci-002",
        prompt: `pretend you are a 911 dispatch officer, here is an emergency: ${convo} 
        extract the nature of this emergency in less than 5 key words: `,
        temperature: 0.9,
        max_tokens: 2048,
      });
  
      const emergencyresp = response.data.choices[0].text.trim();
      req.session.emergency = emergencyresp;
      emergency = emergencyresp;
  
      const botResponce = "Okay, stay calm. Can you tell me your location?";
      convo += botResponce;
      return botResponce;
    }
  
    if (!req.session.location) {
      const response = await openai.createCompletion({
        model: "text-davinci-002",
        prompt: `Imagine you are a 911 dispatch officer. 
        You have received the following message delimited by triple quotation marks: """${convo.toLowerCase()}""". 
        Your task is to extract and format the location as an address or location. 
        If the caller did not provide a location, please return "undefined." 
        If a location or address is mentioned, 
        provide it as 'location:' followed by the formatted address or location.`,
        temperature: 0.9,
        max_tokens: 2048,
      });
  
      const locationresp = response.data.choices[0].text.trim();
      console.log(locationresp);
  
      if (locationresp == "undefined" && redo[0] < 1) {
        console.log("no location given");
        const botResponce =
          "Okay, stay calm. tell me your location or where you remember being last?";
        convo += botResponce;
        redo[0] += 1;
        return botResponce;
      }
  
      req.session.location = locationresp;
      location = locationresp;
  
      const botResponce = "Okay, can I get your full name";
      convo += botResponce;
      return botResponce;
    }
    if (!req.session.name) {
      const response = await openai.createCompletion({
        model: "text-davinci-002",
        prompt: `Imagine you are a 911 dispatch officer. 
        You have received the following message delimited by triple quotation marks: """${convo.toLowerCase()}""". 
        Your task is to extract the caller's name or return "undefined" if the caller did not provide one. 
        Please provide the extracted name as 'name:' followed by the caller's name, or simply 'name: undefined' if no name is mentioned.`,
        temperature: 0.9,
        max_tokens: 2048,
      });
  
      const nameresp = response.data.choices[0].text.trim();
  
      if (nameresp == "undefined" && redo[1] < 1) {
        console.log("no name given");
        const botResponce =
          "I need you to remain calm, we will get help to you as soon as possible. Can I get your name again?";
        convo += botResponce;
        redo[1] += 1;
        return botResponce;
      }
  
      req.session.name = nameresp;
      callerName = nameresp;
  
      const botResponce =
        "and whats your phone number just in case we are disconnected";
      convo += botResponce;
      return botResponce;
    }
    if (!req.session.number) {
      const response = await openai.createCompletion({
        model: "text-davinci-002",
        prompt: `Imagine you are a 911 dispatch officer. 
        You have received the following message delimited by triple quotation marks: """${convo.toLowerCase()}""". 
        Your task is to extract the caller's phone number directly from the message or return "undefined" if no number is provided. 
        Please format your response as 'phone number:' followed by the extracted phone number, or 'phone number: undefined' if no number is found in the message.`,
        temperature: 0.9,
        max_tokens: 2048,
      });
  
      const numberresp = response.data.choices[0].text.trim();
  
      if (numberresp == "undefined" && redo[2] < 1) {
        console.log("no number given");
        const botResponce =
          "Don't worry I will get help to you as soon as possible, but I need a phone number?";
        convo += botResponce;
        redo[2] += 1;
        return botResponce;
      }
  
      req.session.number = numberresp;
      number = numberresp;
    }
  
    req.session.prompt = `As an automated AI dispatch officer conversing with a human, you have the past conversation delimited by triple quotation marks: """${convo}""". 
    Your responsibility is to generate a comprehensive report for this emergency, considering all key details, and prepare for the next 911 dispatcher to get in touch with the caller.
    In your role as a dispatch officer, prioritize providing assistance to the caller by extracting additional crucial information and offering guidance on what actions they can take immediately. 
    Write the next dispatcher line.
    Only ask one short, direct, succinct question to the caller.
    Do not ask previous questions that have been asked before. 
          `;
  
    if (count < 4) {
      req.session.prompt += `
              Ask one short, direct, succinct question to the caller and provide the caller help in this situation. 
              Do not ask previous questions that have been asked already.  
              Dispatcher:\n`;
    } else if (count == 4 || count > 4) {
      req.session.prompt += `
      Conclude the call by reassuring the caller with the following message: 'Don't worry, help is on the way. 
      I'm going to end the call to coordinate dispatch efforts.' 
      Additionally, inform them, 'You should expect a response from 9-1-1 officers soon.' 
      Use the 'Dispatcher:' tag to indicate the dispatcher's response.`;
      hangUp = true;
    } else {
      req.session.prompt +=
        `Promptly gather any additional pertinent details that a dispatcher would require for this situation. 
        Simultaneously, advise the caller on immediate actions they can take to ensure their safety until help arrives. 
        Avoid duplicating information already provided. 
        Please present this information using the 'Dispatcher:' tag to signify the dispatcher's response.`;
    }
  
    let botResponce = await openai.createCompletion({
      model: "text-davinci-002",
      prompt: req.session.prompt,
      temperature: 0.9,
      max_tokens: 2048,
    });
  
    if (botResponce.data.choices[0].text == "") {
      return `Thank you for providing all of this valuable information. 
      A 9-1-1 dispatch officer will be reaching out to you as soon as possible to assist you further.`;
    } else {
      console.log("adding response");
      let toreturn = botResponce.data.choices[0].text;
      convo += toreturn.trim();
      count += 1;
      return toreturn;
    }
}

  