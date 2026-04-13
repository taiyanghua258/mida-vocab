const mongoose = require('./node_modules/mongoose');
const Word = require('./models/Word');
const ReviewLog = require('./models/ReviewLog');
const tsfsrs = require('./node_modules/ts-fsrs');

async function test() {
  await mongoose.connect('mongodb://localhost:27017/my-vocab');
  console.log('Connected');
  const w = await Word.findOne({ japanese: "gram" });
  console.log(w);
  console.log(w.language);
  process.exit(0);
}
test().catch(e => { console.error(e); process.exit(1); });
