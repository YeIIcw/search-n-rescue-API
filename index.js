//importing libraries
const cors = require("cors");
const express = require("express");
const session = require("express-session");
require("dotenv").config();
const { Configuration, OpenAIApi } = require("openai");
const twilio = require("twilio");
const bodyParser = require("body-parser");

//initializing app + defining port
const app = express();
const port = 3001;

//connecting middlewear
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

// configuring open ai
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});


const openai = new OpenAIApi(configuration);


app.post("/", (req, res) => {
    // Handle the POST request data
    const postData = req.body;
  
    // Add your logic to process the received data
    console.log("Received POST request:", postData);
  
    // Send a response back to the client
    res.send("POST request received successfully");
  });