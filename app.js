const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const app = express();
module.exports = app;
app.use(express.json());

const dbPath = path.join(__dirname, "twitterClone.db");
let db = null;

const initializerDatabaseServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initializerDatabaseServer();

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const selectUserQuery = `select * from user 
    where username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    const createUserData = `insert into user 
        (username, name, password, gender) values ('${username}', 
        '${name}', '${hashedPassword}', '${gender}')`;
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      let newUserDetail = await db.run(createUserData);
      response.status(200);
      response.send("User created successfully");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `select * from user where 
    username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "wertyuhggfg");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

const authenticationToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "wertyuhggfg", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};
//Returns the latest tweets of people whom the user follows. Return 4 tweets at a time

app.get(
  "/user/tweets/feed/",
  authenticationToken,
  async (request, response) => {
    const userTweetQuery = `select user.username, T.tweet, T.date_time as dateTime from
    (follower inner join tweet on follower.following_user_id = tweet.user_id)
     as T inner join user on T.user_id = user.user_id order by T.date_time DESC
     limit 4;`;
    const dbResponse = await db.all(userTweetQuery);
    response.send(dbResponse);
  }
);

//Returns the list of all names of people whom the user follows
app.get("/user/following/", authenticationToken, async (request, response) => {
  const userFollowingQuery = `select user.name from user inner join follower 
    ON user.user_id = follower.following_user_id`;
  const dbResponse = await db.all(userFollowingQuery);
  response.send(dbResponse);
});

//Returns the list of all names of people who follows the user

app.get("/user/followers/", authenticationToken, async (request, response) => {
  const userFollowerQuery = `select user.name from user inner join follower 
    ON user.user_id = follower.follower_user_id`;
  const dbResponse = await db.all(userFollowerQuery);
  response.send(dbResponse);
});

//API 6

app.get("/tweets/:tweetId/", authenticationToken, async (request, response) => {
  const { tweetId } = request.params;
  const sqlQueryOfTweet = `select tweet.tweet, count(like.user_id) as
  likes, count(reply.user_id) as replies, tweet.date_time as DateTime from 
  tweet natural join reply natural join like where tweet_id = ${tweetId};`;
  const dbResponse = await db.get(sqlQueryOfTweet);
  response.send(dbResponse);
});
