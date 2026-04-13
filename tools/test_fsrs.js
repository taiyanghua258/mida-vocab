const mongoose = require('mongoose');
const Word = require('../backend/models/Word');
const User = require('../backend/models/User');
const ReviewLog = require('../backend/models/ReviewLog');

mongoose.connect('mongodb://localhost:27017/my-vocab');
async function test() {
  const word = await Word.findOne({ japanese: "gram" });
  if (!word) {
    console.log("no gram found");
    process.exit(1);
  }
  console.log("word:", word);
  
  const studyController = require('../backend/controllers/studyController');
  // Mock req, res
  const req = {
    userId: word.userId,
    body: { wordId: word._id, result: 'good' }
  };
  const res = {
    json: (data) => console.log('success:', data),
    status: (code) => ({ json: (data) => console.log('error:', code, data) })
  };
  
  await studyController.reviewWord(req, res);
  process.exit(0);
}
test();
