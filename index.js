import express from "express";
import { MongoClient } from "mongodb";

const app = express();
const PORT = 9000;

const MONGO_URL = "mongodb://127.0.0.1:27017";

async function createConnection() {
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  return client;
}

const clientPromise = createConnection().catch((error) => {
  console.error("Failed to connect MongoDB:", error);
});

app.use(express.json());

app.get("/students", async(req, res) => {
  try {
    const client = await clientPromise;
    const stud = await client.db("mentor_student").collection("students").find().toArray();
    res.status(200).json(stud);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to create student" });
  };
})

app.get("/mentors", async(req, res) => {
  try {
    const client = await clientPromise;
    const ment = await client.db("mentor_student").collection("mentors").find().toArray();
    res.status(200).json(ment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error"});
  };
})

app.post("/students", async (req, res) => {
  try {
    const client = await clientPromise;
    const newStudent = req.body;
    const result = await client
      .db("mentor_student")
      .collection("students")
      .insertOne(newStudent);
    res.status(201).json({ message: "Student created successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error"});
  }
});

app.post("/mentors", async (req, res) => {
  try {
    const client = await clientPromise;
    const newMentor = req.body;
    const result = await client
      .db("mentor_student")
      .collection("mentors")
      .insertOne(newMentor);
    res.status(201).json({ message: "Mentor created successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error"});
  }
});

// Select one mentor and add multiple students and students who has mentor already will not be updated

app.put("/mentors/:name", async (req, res) => {
  try {
    const client = await clientPromise;
    const { name } = req.params;
    const { studentNames } = req.body;

    const mentor = await client
      .db("mentor_student")
      .collection("mentors")
      .findOne({ mentorName: name });

    if (!mentor) {
      res.status(404).json({ message: "Mentor not found" });
    } else {
      const students = await client
        .db("mentor_student")
        .collection("students")
        .find({
          studentName: { $in: studentNames },
          mentor: { $exists: false }
        })
        .toArray();

      if (students.length === 0) {
        res.status(404).json({ message: "No matching students found" });
      } else {
        const updatedStudents = students.filter((student) => !student.mentor && !student.mentorName);

        if (updatedStudents.length === 0) {
          res.status(400).json({ message: "All students already have a mentor" });
        } else {
          await client
            .db("mentor_student")
            .collection("students")
            .updateMany(
              {
                _id: { $in: updatedStudents.map((student) => student._id) },
                mentor: { $exists: false },
                mentorName: { $exists: false }
              },
              { $set: { mentorName: mentor.mentorName } }
            );

          res.status(200).json({ message: "Students assigned to mentor successfully" });
        }
      }
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error"});
  }
});

// Assign a mentor to a student or update new mentor and move existing mentor to previous mentor

app.put("/students/:name/assign-mentor", async (req, res) => {
  try {
    const client = await clientPromise;
    const { name } = req.params;
    const { mentorName } = req.body;

    const student = await client
      .db("mentor_student")
      .collection("students")
      .findOne({ studentName: name });

    if (!student) {
      res.status(404).json({ message: "Student not found" });
    } else {
      const mentor = await client
        .db("mentor_student")
        .collection("mentors")
        .findOne({ mentorName });

      if (!mentor) {
        res.status(404).json({ message: "Mentor not found" });
      } else {
        if (student.mentorName) {
          await client
            .db("mentor_student")
            .collection("students")
            .updateOne(
              { _id: student._id },
              { $set: { prev_mentor: student.mentorName } }
            );
        }

        await client
          .db("mentor_student")
          .collection("students")
          .updateOne(
            { _id: student._id },
            { $set: { mentorName: mentor.mentorName } }
          );

        res.status(200).json({ message: "Mentor assigned to student successfully" });
      }
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error"});
  }
});


// Get the students who has particular mentor

app.get("/mentor/:name/list-student", async (req, res) => {
  try {
    const client = await clientPromise;
    const { name } = req.params;

    const student  = await client.db("mentor_student").collection("students").find({mentorName: name}).toArray();

    res.status(200).json(student);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error"});
  }
})

// Get the students who has previous mentor

app.get("/students/:name/previous-mentor", async (req, res) => {
  try {
    const client = await clientPromise;
    const { name } = req.params;

    const student = await client
      .db("mentor_student")
      .collection("students")
      .findOne({ studentName: name, prev_mentor: { $exists: true } }); 

    if (!student) {
      res.status(404).json({ message: "Student not found or has no previous mentor" });
    } else {
      const prevmentor = await client
        .db("mentor_student")
        .collection("students")
        .findOne({ studentName: name });

        res.status(404).json(prevmentor);
      } 
    
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error"});
  }
});



app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
