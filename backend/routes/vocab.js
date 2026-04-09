const express = require('express');
const router = express.Router();
const vocabController = require('../controllers/vocabController');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/', vocabController.getWords);
router.get('/export', vocabController.exportWords);
router.get('/:id', vocabController.getWord);
router.post('/', vocabController.addWord);
router.post('/import', vocabController.importWords);
router.put('/:id', vocabController.updateWord);
router.post('/batch-delete', vocabController.batchDeleteWords);
router.delete('/:id', vocabController.deleteWord);

module.exports = router;
