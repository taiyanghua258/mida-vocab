const express = require('express');
const router = express.Router();
const vocabController = require('../controllers/vocabController');
const auth = require('../middleware/auth');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

router.use(auth);

router.get('/', vocabController.getWords);
router.get('/export', vocabController.exportWords);
router.get('/:id', vocabController.getWord);
router.post('/', vocabController.addWord);
router.post('/import', vocabController.importWords);
router.post('/upload-apkg', upload.single('dictFile'), vocabController.uploadAndConvertApkg);
router.put('/:id', vocabController.updateWord);
router.post('/batch-delete', vocabController.batchDeleteWords);
router.delete('/:id', vocabController.deleteWord);

module.exports = router;
