import fs from "fs";
import admin from "firebase-admin";
import express from "express";
import { db, connectToDb } from "./db.js";
import cors from "cors";
import "dotenv/config";

import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const credentials = JSON.parse(fs.readFileSync("./credentials.json"));

admin.initializeApp({
  credential: admin.credential.cert(credentials),
});

const app = express();

var corsOptions = {
  origin: "http://localhost:3000",
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.json());

// for frontend server
app.use(express.static(path.join(__dirname, "../build")));

app.get(/^(?!\/?api).+/, (req, res) => {
  res.sendFile(path.join(__dirname, "../build/index.html"));
});

app.use(async (req, res, next) => {
  const { authtoken } = req.headers;
  if (authtoken) {
    try {
      req.user = await admin.auth().verifyIdToken(authtoken);
    } catch (err) {
      return res.status(401).send("Invalid authentication token");
    }
  }

  req.user = req.user || {};

  next();
});

// app.get("/hello", (req, res) => {
//   res.send("Hello!");
// });

// app.post("/hello", (req, res) => {
//   res.send(`Hello ${req.body.name}!`);
// });

// app.get("/hello/:name", (req, res) => {
//   res.send(`Hello ${req.params.name}!`);
// });

app.get("/api/articles/:name", async (req, res) => {
  const { name } = req.params;
  const { uid } = req.user;

  const article = await db.collection("articles").findOne({ name });

  if (article) {
    const upvotedId = article.upvotedIds || [];

    const canUpvote = uid && !upvotedId.includes(uid);
    article.canUpvote = canUpvote;

    res.status(200).json(article);
  } else {
    res.status(404).send("Article not found");
  }
});

app.use((req, res, next) => {
  if (req.user) {
    next();
  } else {
    res.status(401).send("Unauthenticated");
  }
});

app.put("/api/articles/:name/upvote", async (req, res) => {
  const { name } = req.params;
  const { uid } = req.user;

  const article = await db.collection("articles").findOne({ name });

  if (article) {
    const upvotedId = article.upvotedIds || [];

    const canUpvote = uid && !upvotedId.includes(uid);

    if (canUpvote) {
      await db.collection("articles").updateOne(
        { name },
        {
          $inc: { upvotes: 1 },
          $push: { upvotedIds: uid },
        }
      );
    }

    const updatedArticle = await db.collection("articles").findOne({ name });
    updatedArticle.canUpvote = canUpvote;

    //   if (article) {
    //     res.status(200).send(`${name} now has ${article.upvotes} upvotes`);
    //   } else {
    //     res.status(404).send("Article not found");
    //   }

    res.status(200).json(updatedArticle);
  } else {
    res.status(404).send("Article not found");
  }
});

app.post("/api/articles/:name/comments", async (req, res) => {
  const { text } = req.body;
  const { name } = req.params;
  const { email } = req.user;
  const { uid } = req.user;

  await db.collection("articles").updateOne(
    { name },
    {
      $push: { comments: { postedBy: email, text } },
    }
  );

  const article = await db.collection("articles").findOne({ name });

  //   if (article) {
  //     article.comments.push({ postedBy, text });
  //     res.status(200).send(article);
  //   } else {
  //     res.status(404).send("Article not found");
  //   }

  if (article) {
    const upvotedId = article.upvotedIds || [];
    const canUpvote = uid && !upvotedId.includes(uid);
    article.canUpvote = canUpvote;

    res.status(200).json(article);
  } else {
    res.status(404).send("Article not found");
  }
});

const PORT = process.env.PORT || 8000;

connectToDb(() => {
  console.log("Connected to database");
  app.listen(8000, () => {
    console.log("Server is listening on port" + PORT);
  });
});
