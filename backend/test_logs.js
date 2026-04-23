const mongoose = require('mongoose');
const ReviewLog = require('./models/ReviewLog');
const Word = require('./models/Word');

mongoose.connect('mongodb://localhost:27017/my-vocab')
  .then(async () => {
    const todayStart = new Date();
    todayStart.setHours(0,0,0,0);
    const logsEn = await ReviewLog.find({ language: 'en', reviewDate: { $gte: todayStart } });
    console.log(`English ReviewLogs today: ${logsEn.length}`);
    if (logsEn.length > 0) {
      const word = await Word.findById(logsEn[0].wordId);
      console.log('Sample word:', word.japanese, word.language);
    }
    const logsJa = await ReviewLog.find({ language: 'ja', reviewDate: { $gte: todayStart } });
    console.log(`Japanese ReviewLogs today: ${logsJa.length}`);
    process.exit(0);
  });
