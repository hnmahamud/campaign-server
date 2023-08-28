const express = require("express");
const cors = require("cors");
require("dotenv").config();
const nodemailer = require("nodemailer");
const schedule = require("node-schedule");

const app = express();
const port = process.env.PORT || 5000;

// middleware
const corsOptions = {
  origin: "*",
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());

// Send Email
const sendMail = (emailData, emailAddresses) => {
  const transporter = nodemailer.createTransport({
    // host: "smtp.gmail.com", // Your SMTP server hostname
    // port: 465, // Your SMTP server port (587 for TLS, 465 for SSL)
    // secure: true, // true for 465, false for other ports
    service: "gmail",
    auth: {
      user: process.env.EMAIL,
      pass: process.env.PASS,
    },
  });

  // verify connection configuration
  transporter.verify(function (error, success) {
    if (error) {
      console.log(error);
    } else {
      console.log("Server is ready to take our messages");
    }
  });

  const mailOptions = {
    from: process.env.EMAIL,
    to: emailAddresses,
    subject: emailData?.subject,
    html: `<p>${emailData?.body}</p>`,
  };

  transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      console.log(error);
    } else {
      console.log("Email sent: " + info.response);
    }
  });
};

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.6jia9zl.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    client.connect();

    const database = client.db("campaignDB");
    const campaignCollection = database.collection("campaigns");
    const prospectCollection = database.collection("prospects");

    // Get all user specific campaign
    app.get("/campaigns", async (req, res) => {
      const queryEmail = req.query.email;

      const query = { user_email: queryEmail };
      const result = await campaignCollection.find(query).toArray();
      res.send(result);
    });

    // Get single campaign
    app.get("/single-campaign/:id", async (req, res) => {
      const id = req.params.id;

      const query = { _id: new ObjectId(id) };
      const result = await campaignCollection.findOne(query);
      res.send(result);
    });

    // Get all campaign specific prospects
    app.get("/prospects", async (req, res) => {
      const queryId = req.query.id;
      const queryEmail = req.query.email;

      const query = { campaign_id: queryId, user_email: queryEmail };
      const result = await prospectCollection.find(query).toArray();
      res.send(result);
    });

    // Get all campaign specific prospects
    app.get("/single-prospect/:id", async (req, res) => {
      const queryId = req.params.id;

      const query = { _id: new ObjectId(queryId) };
      const result = await prospectCollection.findOne(query);
      res.send(result);
    });

    // Create campaigns
    app.post("/campaigns", async (req, res) => {
      const newCampaign = req.body;
      const result = await campaignCollection.insertOne(newCampaign);

      if (result.insertedId) {
        console.log("Campaign added successful!");
      } else {
        console.log("Campaign added failed!");
      }
      res.send(result);
    });

    // Create prospects
    app.post("/prospects", async (req, res) => {
      const newProspect = req.body;
      const result = await prospectCollection.insertOne(newProspect);

      if (result.insertedId) {
        console.log("Prospect added successful!");
      } else {
        console.log("Prospect added failed!");
      }
      res.send(result);
    });

    // Change classes status
    app.patch("/prospects/:id", async (req, res) => {
      const id = req.params.id;

      const firstName = req.body.first_name;
      const lastName = req.body.last_name;
      const email = req.body.email;

      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          first_name: firstName,
          last_name: lastName,
          email: email,
        },
      };
      const result = await prospectCollection.updateOne(filter, updateDoc);
      if (result.modifiedCount > 0) {
        console.log("Prospect updated successfully!");
      } else {
        console.log("Prospect updated failed!");
      }
      res.send(result);
    });

    // Delete specific campaign and its prospects
    app.delete("/campaigns/:id", async (req, res) => {
      const id = req.params.id;

      const campaignQuery = { _id: new ObjectId(id) };
      const campaignResult = await campaignCollection.deleteOne(campaignQuery);
      if (campaignResult.deletedCount === 1) {
        console.log("Successfully deleted one document.");
      } else {
        console.log("No documents matched the query. Deleted 0 documents.");
      }

      const prospectQuery = { campaign_id: id };
      const prospectResult = await prospectCollection.deleteMany(prospectQuery);
      if (prospectResult.deletedCount > 0) {
        console.log("Successfully deleted multiple document.");
      } else {
        console.log("No documents matched the query. Deleted 0 documents.");
      }

      res.send({ campaignResult, prospectResult });
    });

    // Delete specific prospect
    app.delete("/prospects/:id", async (req, res) => {
      const id = req.params.id;

      const query = { _id: new ObjectId(id) };
      const result = await prospectCollection.deleteOne(query);
      if (result.deletedCount === 1) {
        console.log("Successfully deleted one document.");
      } else {
        console.log("No documents matched the query. Deleted 0 documents.");
      }
      res.send(result);
    });

    // Get all campaign specific prospects
    app.post("/email-send", async (req, res) => {
      const queryId = req.query.id;
      const queryEmail = req.query.userEmail;
      const querySchedule = req.query.schedule;

      const campaignQuery = { _id: new ObjectId(queryId) };
      const campaignResult = await campaignCollection.findOne(campaignQuery);

      const data = {
        subject: campaignResult?.title,
        body: campaignResult?.content,
      };

      const prospectQuery = { campaign_id: queryId, user_email: queryEmail };
      const prospectResult = await prospectCollection
        .find(prospectQuery)
        .toArray();

      let emails = [];
      prospectResult.forEach((singleProspect) => {
        const targetEmail = singleProspect?.email;
        emails.push(targetEmail);
      });

      const targetDate = new Date(querySchedule);
      const job = schedule.scheduleJob(targetDate, () => {
        // Place your task logic here
        sendMail(data, emails);

        // Cancel the job after it runs
        job.cancel();
      });

      res.send({ status: true });
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Server Running...");
});

app.listen(port, () => {
  console.log(`App listening on port ${port}`);
});
