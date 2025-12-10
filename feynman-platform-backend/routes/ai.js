const { answerWithRAG } = require('../controllers/aiagent');
const express = require('express');
const router = express.Router();
const auth = require("../middleware/auth")
router.post('/rag-qa', auth, answerWithRAG);
module.exports = router;