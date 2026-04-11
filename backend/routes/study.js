const express = require('express');
const router = express.Router();
const studyController = require('../controllers/studyController');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/due', studyController.getDueWords);
router.get('/scheduling', studyController.getSchedulingInfo);
router.post('/review', studyController.reviewWord);
router.post('/undo', studyController.undoReview);
router.post('/extra', studyController.addExtraNewWords);
router.get('/stats', studyController.getStats);
router.get('/reviewed_today', studyController.getTodayReviewedWords);
module.exports = router;
