import { useState } from 'react';
import axios from 'axios';


function App() {
  const [file, setFile] = useState(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const uploadFile = async () => {
    setError('');
    if (!file) return alert('Select a file first!');
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await axios.post('http://localhost:5001/upload', formData);
      alert('File uploaded and processed.');
    } catch (err) {
      setError('File upload failed.');
    } finally {
      setLoading(false);
    }
  };

  const askQuestion = async () => {
    setError('');
    if (!question) return;
    setLoading(true);
    try {
      const res = await axios.post('http://localhost:5001/ask', { question });
      setAnswer(res.data.answer);
    } catch (err) {
      setError('Failed to get answer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>📄 Human Health RAG (PDF/TXT)</h1>

      <input type="file" accept=".pdf,.txt" onChange={(e) => setFile(e.target.files[0])} />
      <button onClick={uploadFile} disabled={loading}>Upload</button>

      <br /><br />
      <input
        type="text"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Ask a question..."
        style={{ width: 300 }}
        disabled={loading}
      />
      <button onClick={askQuestion} disabled={loading}>Ask</button>

      {loading && <div>Loading...</div>}
      {error && <div style={{ color: 'red' }}>{error}</div>}

      <h3>Answer:</h3>
      <pre>{answer}</pre>
    </div>
  );
}

export default App;
