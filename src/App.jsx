import { useState, useEffect } from 'react';
import { Sparkles, Send, Clock, Trash2, Pencil, Tag, LogOut, LogIn } from 'lucide-react';
import { collection, addDoc, deleteDoc, updateDoc, doc, onSnapshot, query, orderBy, where } from 'firebase/firestore';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { db, auth, googleProvider } from './firebase';
import './App.css';

function App() {
  const [noteText, setNoteText] = useState('');
  const [notes, setNotes] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) {
      setNotes([]);
      return;
    }
    const q = query(collection(db, 'notes'), where('uid', '==', user.uid), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setNotes(notesData);
    });
    return () => unsubscribe();
  }, [user]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error("Login failed:", err);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Logout failed:", err);
    }
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

    setIsProcessing(true);
    setErrorMessage('');

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ noteText })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate response');
      }

      const cleanedText = data.result.replace(/```json\n?|\n?```/g, '');
      const parsedData = JSON.parse(cleanedText);

      await addDoc(collection(db, 'notes'), {
        original: noteText,
        category: parsedData.category,
        translation: parsedData.translation,
        timestamp: new Date().toISOString(),
        completed: false,
        uid: user.uid
      });
      setNoteText('');
      setErrorMessage('');
    } catch (error) {
      console.error(error);
      setErrorMessage(`에러가 발생했습니다: ${error.message}`);
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
        {user && (
          <div style={{ position: 'absolute', top: '1rem', right: '1rem', zIndex: 10 }}>
            <button className="btn-icon" onClick={handleLogout} title="로그아웃" style={{ opacity: 1, padding: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '50%' }}>
              <LogOut size={18} />
            </button>
          </div>
        )}
        {!user ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '2rem', padding: '2rem', textAlign: 'center' }}>
            <h2 style={{ color: '#e2e8f0', margin: 0, fontSize: '1.8rem' }}>나만의 비밀 노트</h2>
            <p style={{ color: '#94a3b8', margin: 0 }}>메모를 보호하려면 구글 계정으로 안전하게 로그인하세요.</p>
            <button onClick={handleLogin} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.8rem 1.5rem', background: '#e2e8f0', color: '#0f0f11', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
              <LogIn size={20} /> 구글 계정으로 로그인
            </button>
          </div>
        ) : (
          <>
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
        </>
        )}
      </main>
    </div>
  );
}

export default App;
