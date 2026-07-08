import { useState, useEffect } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Sparkles, Send, KeyRound, Clock, Trash2, Pencil, Tag } from 'lucide-react';
import { collection, addDoc, deleteDoc, updateDoc, doc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from './firebase';
import './App.css';

function App() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [noteText, setNoteText] = useState('');
  const [notes, setNotes] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'notes'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setNotes(notesData);
    });
    return () => unsubscribe();
  }, []);

  const saveApiKey = (e) => {
    const key = e.target.value;
    setApiKey(key);
    localStorage.setItem('gemini_api_key', key);
  };

  const deleteNote = async (id) => {
    try {
      await deleteDoc(doc(db, 'notes', id));
    } catch (err) {
      console.error("Error deleting note:", err);
    }
  };

  const toggleComplete = async (id) => {
    const note = notes.find(n => n.id === id);
    if (note) {
      try {
        await updateDoc(doc(db, 'notes', id), { completed: !note.completed });
      } catch (err) {
        console.error("Error updating note:", err);
      }
    }
  };

  const editCategory = async (id, currentCategory) => {
    const newCategory = window.prompt("새로운 카테고리를 입력하세요:", currentCategory);
    if (newCategory && newCategory.trim() !== "" && newCategory !== currentCategory) {
      try {
        await updateDoc(doc(db, 'notes', id), { category: newCategory.trim() });
      } catch (err) {
        console.error("Error updating category:", err);
      }
    }
  };

  const editContent = async (id, currentContent) => {
    const newContent = window.prompt("수정할 내용을 입력하세요:", currentContent);
    if (newContent !== null && newContent.trim() !== "" && newContent !== currentContent) {
      try {
        await updateDoc(doc(db, 'notes', id), { translation: newContent.trim() });
      } catch (err) {
        console.error("Error updating content:", err);
      }
    }
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

      await addDoc(collection(db, 'notes'), {
        original: noteText,
        category: data.category,
        translation: data.translation,
        timestamp: new Date().toISOString(),
        completed: false
      });
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
      <aside className="app-sidebar">
        <div className="sidebar-header">
          <Sparkles size={24} color="#8b5cf6" />
          <h1>FlowNote</h1>
        </div>
        
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
      </aside>

      <main className="main-content">
        <section className="notes-list">
          {notes.length === 0 && (
            <div className="empty-state">
              작성된 메모가 없습니다. 아래에 첫 메모를 남겨보세요!
            </div>
          )}
          
          {Object.entries(
            notes.reduce((acc, note) => {
              const cat = note.category || 'Uncategorized';
              if (!acc[cat]) acc[cat] = [];
              acc[cat].push(note);
              return acc;
            }, {})
          ).map(([category, categoryNotes]) => (
            <div key={category} className="category-group">
              <h2 className="category-title">{category}</h2>
              <div className="category-items">
                {categoryNotes.map(note => (
                  <div key={note.id} className="note-card">
                    <div className="note-content">
                      {category.toLowerCase() === 'todo' && (
                        <input 
                          type="checkbox" 
                          className="todo-checkbox"
                          checked={!!note.completed}
                          onChange={() => toggleComplete(note.id)}
                        />
                      )}
                      <span className={note.completed ? 'completed-text' : ''}>
                        {note.translation}
                      </span>
                    </div>
                    
                    <div className="note-meta">
                      <span className="note-time">{formatDate(note.timestamp)}</span>
                      <div className="note-actions">
                        <button className="btn-icon" onClick={() => editCategory(note.id, category)} title="카테고리 수정">
                          <Tag size={14} />
                        </button>
                        <button className="btn-icon" onClick={() => editContent(note.id, note.translation)} title="내용 수정">
                          <Pencil size={14} />
                        </button>
                        <button className="btn-icon btn-delete-icon" onClick={() => deleteNote(note.id)} title="노트 삭제">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>

        <section className="input-panel">
          {errorMessage && (
            <div className="error-banner">
              {errorMessage}
            </div>
          )}

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
