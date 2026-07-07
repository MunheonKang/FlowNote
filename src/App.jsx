import { useState, useEffect } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Sparkles, Send, KeyRound, Clock, Trash2 } from 'lucide-react';
import './App.css';

function App() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [noteText, setNoteText] = useState('');
  const [notes, setNotes] = useState(() => {
    const saved = localStorage.getItem('flownote_notes');
    return saved ? JSON.parse(saved) : [];
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    localStorage.setItem('flownote_notes', JSON.stringify(notes));
  }, [notes]);

  const saveApiKey = (e) => {
    const key = e.target.value;
    setApiKey(key);
    localStorage.setItem('gemini_api_key', key);
  };

  const deleteNote = (id) => {
    setNotes(prev => prev.filter(note => note.id !== id));
  };

  const processNote = async () => {
    if (!noteText.trim()) return;
    if (!apiKey) {
      setErrorMessage("Please enter your Gemini API Key first.");
      return;
    }

    setIsProcessing(true);
    setErrorMessage('');

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ 
        model: "gemini-flash-lite-latest",
        generationConfig: {
          responseMimeType: "application/json",
          maxOutputTokens: 500,
        }
      });

      const prompt = `
        You are a productivity assistant. 
        Analyze the following user note and perform two tasks:
        1. Categorize it into one short category (e.g., Todo, Idea, Meeting, Personal, Bug, etc.)
        2. Translate the entire note into natural English.

        Output ONLY a valid JSON object with exact keys "category" and "translation".
        User note:
        "${noteText}"
      `;

      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text().trim();
      
      const cleanedText = text.replace(/```json\n?|\n?```/g, '');
      const data = JSON.parse(cleanedText);

      const newNote = {
        id: crypto.randomUUID(),
        original: noteText,
        category: data.category,
        translation: data.translation,
        timestamp: new Date().toISOString()
      };

      setNotes(prev => [newNote, ...prev]);
      setNoteText('');
      setErrorMessage('');
    } catch (error) {
      console.error(error);
      if (error.message.includes('404')) {
        try {
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
          const data = await res.json();
          const models = data.models
            ? data.models.filter(m => m.supportedGenerationMethods.includes("generateContent")).map(m => m.name.replace('models/', '')).join(', ')
            : '목록을 불러올 수 없음';
          setErrorMessage(`[모델을 찾을 수 없음]\n현재 API 키로 사용 가능한 텍스트 모델 목록:\n${models}\n\n위 목록에 있는 모델 중 하나를 저에게 알려주시면 코드를 수정해 드리겠습니다.`);
        } catch (fetchErr) {
          setErrorMessage(`에러가 발생했습니다: ${error.message}\n\nAPI 키가 유효한지 다시 확인해주세요.`);
        }
      } else {
        setErrorMessage(`에러가 발생했습니다: ${error.message}\n\nAPI 키가 유효한지 다시 확인해주세요.`);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDate = (isoString) => {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('ko-KR', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    }).format(date);
  };

  return (
    <div className="app-container">
      <main className="main-content">
        <section className="notes-list">
          {[...notes].reverse().map(note => (
            <div key={note.id} className="note-card">
              <div className="note-header">
                <div>
                  <span className="note-category">{note.category}</span>
                  <span className="note-time" style={{ marginLeft: '10px' }}>
                    <Clock size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                    {formatDate(note.timestamp)}
                  </span>
                </div>
                <button className="btn-delete" onClick={() => deleteNote(note.id)} title="노트 삭제">
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="note-content">{note.translation}</div>
            </div>
          ))}
        </section>

        <section className="input-panel">
          {errorMessage && (
            <div className="error-banner">
              {errorMessage}
            </div>
          )}

          <div className="api-key-section">
            <KeyRound size={16} color="#64748b" />
            <input 
              type="password" 
              className="input-field api-input" 
              placeholder="Gemini API Key" 
              value={apiKey}
              onChange={saveApiKey}
            />
          </div>

          <div className="note-input-container">
            <textarea 
              className="input-field note-textarea" 
              placeholder="무엇이든 자유롭게 적어보세요... (Ctrl+Enter)"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.ctrlKey) processNote();
              }}
            />
            <button 
              className="btn-primary" 
              onClick={processNote} 
              disabled={isProcessing || !noteText.trim()}
            >
              {isProcessing ? (
                <Sparkles size={18} className="loading-text" />
              ) : (
                <Send size={18} />
              )}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
