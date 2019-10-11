const express = require("express");
const logger = require("morgan");
const mongoose = require("mongoose");
const axios = require("axios");
const cheerio = require("cheerio");

const db = require("./models");
const PORT = 3000;

const app = express();
const engines = require("consolidate");

app.engine("html", engines.mustache);
app.set("view engine", "/");

// Use morgan logger for logging requests
app.use(logger("dev"));
// Parse request body as JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
// Make public a static folder
app.use(express.static("public"));

// Connect to the Mongo DB

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost/MongoHeadlines";
mongoose.connect(MONGODB_URI);

// Routes

// A GET route for scraping the reddit website
app.get("/scrape", function(req, res) {
  // First, we grab the body of the html with axios

  axios.get("https://old.reddit.com/r/indieheads/").then(function(response) {
    console.log("axios is getting here");
    // Then, we load that into cheerio and save it to $ for a shorthand selector
    var $ = cheerio.load(response.data);
    var results = [];

    $("p.title").each(function(i, element) {
      // Save the text of the element in a "title" variable
      var title = $(element).text();

      // In the currently selected element, look at its child elements (i.e., its a-tags),
      // then save the values for any "href" attributes that the child elements may have
      var link = $(element)
        .children()
        .attr("href");

      // Save these results in an object that we'll push into the results array we defined earlier
      results.push({
        title: title,
        link: link
      });
      // });

      // Log the results once you've looped through each of the elements found with cheerio
      console.log(results);

      // Create a new Article using the `result` object built from scraping
      db.Posts.create(results)
        .then(function(dbPost) {
          // View the added result in the console
          console.log("this is the create function");
          console.log(dbPost);
        })
        .catch(function(err) {
          console.log(err);
        });
    });

    // Send a message to the client
    // res.send("Scrape Complete");
    res.render("/", results);
  });
});

// Route for getting all Articles from the db
app.get("/posts", function(req, res) {
  // Grab every document in the Articles collection
  db.Posts.find({})
    .then(function(dbPost) {
      // If we were able to successfully find Articles, send them back to the client
      res.json(dbPost);
      // res.render("/public/index.html");
      res.render("/", results);
    })
    .catch(function(err) {
      // If an error occurred, send it to the client
      res.json(err);
    });
});

// Route for grabbing a specific Article by id, populate it with it's note
app.get("/posts/:id", function(req, res) {
  // Using the id passed in the id parameter, prepare a query that finds the matching one in our db...
  db.Posts.findOne({ _id: req.params.id })
    // ..and populate all of the notes associated with it
    .populate("note")
    .then(function(dbPost) {
      // If we were able to successfully find an Article with the given id, send it back to the client
      res.json(dbPost);
    })
    .catch(function(err) {
      // If an error occurred, send it to the client
      res.json(err);
    });
});

// Route for saving/updating an Article's associated Note
app.post("/posts/:id", function(req, res) {
  // Create a new note and pass the req.body to the entry
  db.Note.create(req.body)
    .then(function(dbNote) {
      // If a Note was created successfully, find one Article with an `_id` equal to `req.params.id`. Update the Article to be associated with the new Note
      // { new: true } tells the query that we want it to return the updated User -- it returns the original by default
      // Since our mongoose query returns a promise, we can chain another `.then` which receives the result of the query
      return db.Posts.findOneAndUpdate(
        { _id: req.params.id },
        { note: dbNote._id },
        { new: true }
      );
    })
    .then(function(dbPost) {
      // If we were able to successfully update an Article, send it back to the client
      res.json(dbPost);
    })
    .catch(function(err) {
      // If an error occurred, send it to the client
      res.json(err);
    });
});

// Start the server
app.listen(PORT, function() {
  console.log("App running on port " + PORT + "!");
});
