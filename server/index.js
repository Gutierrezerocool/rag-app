const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const path = require('path');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();
const port = 5001;

app.use(cors({
  origin: 'http://localhost:3001',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  credentials: true
}));

// Handle preflight requests
app.options('*', cors({
  origin: 'http://localhost:3001',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  credentials: true
}));
app.use(express.json());

const upload = multer({ dest: 'uploads/' });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

let chunks = [];

function chunkText(text, chunkSize = 500) {
  const sentences = text.match(/[^\.!\?]+[\.!\?]+/g) || [text];
  let result = [], chunk = '';

  for (let sentence of sentences) {
    if ((chunk + sentence).length < chunkSize) {
      chunk += sentence;
    } else {
      result.push(chunk.trim());
      chunk = sentence;
    }
  }

  if (chunk) result.push(chunk.trim());
  return result;
}

// Upload PDF or TXT
app.post('/upload', upload.single('file'), async (req, res) => {
  const filePath = path.join(__dirname, req.file.path);
  const ext = path.extname(req.file.originalname).toLowerCase();

  try {
    let text = '';

    if (ext === '.pdf') {
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(dataBuffer);
      text = pdfData.text;
    } else if (ext === '.txt') {
      text = fs.readFileSync(filePath, 'utf-8');
    } else {
      return res.status(400).json({ error: 'Unsupported file type' });
    }

    chunks = chunkText(text);
    fs.unlinkSync(filePath); // cleanup
    res.json({ message: `File processed into ${chunks.length} chunks.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process file' });
  }
});

// Ask a Question
app.post('/ask', async (req, res) => {
  const { question } = req.body;

  if (!chunks.length) return res.status(400).json({ error: 'No document uploaded yet.' });

  const queryWords = question.toLowerCase().split(/\s+/);
  const scored = chunks.map(chunk => {
    const lower = chunk.toLowerCase();
    const score = queryWords.reduce((sum, word) => sum + (lower.includes(word) ? 1 : 0), 0);
    return { chunk, score };
  });

  const top = scored.sort((a, b) => b.score - a.score).slice(0, 3).filter(c => c.score > 0);
  const retrievedContext = top.map(c => c.chunk).join('\n\n');

  const prompt = `
You are a helpful assistant. Based on the following context from a document, answer the user's question clearly and accurately.

Context:
${retrievedContext}

Question: ${question}
Answer:
  `;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
    });
    const answer = completion.choices[0].message.content.trim();
    res.json({ answer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to contact OpenAI' });
  }
});

app.listen(port, () => console.log(`✅ Server running at http://localhost:${port}`));
