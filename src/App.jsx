import { useState, useEffect } from 'react';
import { Sparkles, Send, Clock, Trash2, Pencil, Tag, LogOut, LogIn, GripHorizontal } from 'lucide-react';
import { collection, addDoc, deleteDoc, updateDoc, setDoc, doc, onSnapshot, query, orderBy, where } from 'firebase/firestore';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { db, auth, googleProvider } from './firebase';
import './App.css';

function App() {
  const [noteText, setNoteText] = useState('');
  const [notes, setNotes] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  const [openTabs, setOpenTabs] = useState(['기본 탭']);
  const [activeTab, setActiveTab] = useState('기본 탭');
  const [tabsLoaded, setTabsLoaded] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribeAuth();
  }, []);

  // Ensure activeTab is valid when openTabs changes
  useEffect(() => {
    if (tabsLoaded && !openTabs.includes(activeTab)) {
      setActiveTab(openTabs[0] || '기본 탭');
    }
  }, [openTabs, activeTab, tabsLoaded]);

  useEffect(() => {
    if (!user) {
      setNotes([]);
      setOpenTabs(['기본 탭']);
      setTabsLoaded(false);
      return;
    }
    const q = query(collection(db, 'notes'), where('uid', '==', user.uid), orderBy('timestamp', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let settingsTabs = null;
      const notesData = [];
      
      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        if (data.isSettings) {
          settingsTabs = data.tabs;
        } else {
          notesData.push({ id: docSnap.id, ...data });
        }
      });
      
      setNotes(notesData);
      
      if (settingsTabs && settingsTabs.length > 0) {
        setOpenTabs(settingsTabs);
      } else {
        const existingTabs = new Set(notesData.map(n => n.tab || '기본 탭'));
        setOpenTabs(prev => {
          const combined = new Set([...prev, ...existingTabs]);
          return Array.from(combined);
        });
      }
      setTabsLoaded(true);
    }, (error) => {
      console.error("Firestore error:", error);
    });
    return () => unsubscribe();
  }, [user]);

  const updateTabsInDb = async (newTabs) => {
    if (!user) return;
    setOpenTabs(newTabs); // Optimistic UI
    try {
      await setDoc(doc(db, 'notes', `settings_${user.uid}`), { 
        isSettings: true, 
        uid: user.uid, 
        tabs: newTabs,
        timestamp: new Date(0).toISOString() // Earliest date so it doesn't break ordering
      }, { merge: true });
    } catch (err) {
      console.error("Error updating tabs:", err);
    }
  };

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

  const moveNote = async (id, currentTab, newTab) => {
    if (newTab === 'new') {
      const promptTab = window.prompt("이동할 새 탭의 이름을 입력하세요:");
      if (promptTab && promptTab.trim() !== "" && promptTab !== currentTab) {
        try {
          await updateDoc(doc(db, 'notes', id), { tab: promptTab.trim() });
          if (!openTabs.includes(promptTab.trim())) {
            updateTabsInDb([...openTabs, promptTab.trim()]);
          }
        } catch (err) {
          console.error("Error updating tab:", err);
        }
      }
    } else if (newTab && newTab !== currentTab) {
      try {
        await updateDoc(doc(db, 'notes', id), { tab: newTab });
      } catch (err) {
        console.error("Error updating tab:", err);
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
        tab: activeTab,
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

  const closeTab = (e, cat) => {
    e.stopPropagation();
    if (openTabs.length <= 1) return; // Prevent closing the last tab
    const newTabs = openTabs.filter(t => t !== cat);
    updateTabsInDb(newTabs);
  };

  const addNewTab = () => {
    const tabName = window.prompt("새 탭의 이름을 입력하세요:");
    if (tabName && tabName.trim() !== "" && !openTabs.includes(tabName.trim())) {
      const newTabs = [...openTabs, tabName.trim()];
      updateTabsInDb(newTabs);
      setActiveTab(tabName.trim());
    }
  };

  const handleDragStart = (e, index) => {
    e.dataTransfer.setData('tabIndex', index);
  };

  const handleDrop = (e, dropIndex) => {
    const dragIndex = Number(e.dataTransfer.getData('tabIndex'));
    if (dragIndex === dropIndex) return;
    const newTabs = [...openTabs];
    const [draggedTab] = newTabs.splice(dragIndex, 1);
    newTabs.splice(dropIndex, 0, draggedTab);
    updateTabsInDb(newTabs);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  if (authLoading) {
    return <div className="app-container"></div>;
  }

  return (
    <div className="app-container">
      {!user ? (
        <main className="main-content">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '2rem', padding: '2rem', textAlign: 'center' }}>
            <h2 style={{ color: '#e2e8f0', margin: 0, fontSize: '1.8rem' }}>나만의 비밀 노트</h2>
            <p style={{ color: '#94a3b8', margin: 0 }}>메모를 보호하려면 구글 계정으로 안전하게 로그인하세요.</p>
            <button onClick={handleLogin} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.8rem 1.5rem', background: '#e2e8f0', color: '#0f0f11', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
              <LogIn size={20} /> 구글 계정으로 로그인
            </button>
          </div>
        </main>
      ) : (
        <>
          <main className="main-content">
            <div className="tabs-container">
              {openTabs.map((tab, index) => (
                <div 
                  key={tab} 
                  className={`tab ${activeTab === tab ? 'active-tab' : ''}`}
                  onClick={() => setActiveTab(tab)}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, index)}
                >
                  <GripHorizontal size={14} className="drag-handle" style={{ cursor: 'grab', opacity: 0.5 }} />
                  {tab}
                  {openTabs.length > 1 && (
                    <span className="close-tab" onClick={(e) => closeTab(e, tab)}>×</span>
                  )}
                </div>
              ))}
              <div className="tab add-tab-btn" onClick={addNewTab}>
                + 새 탭
              </div>
            </div>

            <section className="notes-list">
              {notes.filter(note => (note.tab || '기본 탭') === activeTab).length === 0 && (
                <div className="empty-state">
                  작성된 메모가 없습니다. 아래에 첫 메모를 남겨보세요!
                </div>
              )}
              
              {Object.entries(
                notes
                  .filter(note => (note.tab || '기본 탭') === activeTab)
                  .reduce((acc, note) => {
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
                            <select
                              className="btn-icon tab-select"
                              value=""
                              onChange={(e) => moveNote(note.id, note.tab || '기본 탭', e.target.value)}
                              title="다른 탭으로 이동"
                            >
                              <option value="" disabled>이동 ▾</option>
                              {openTabs.filter(t => t !== (note.tab || '기본 탭')).map(t => (
                                <option key={t} value={t}>{t}</option>
                              ))}
                              <option value="new">+ 새 탭 입력...</option>
                            </select>
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
                  placeholder={`[${activeTab}] 관련 메모를 적어보세요... (Ctrl+Enter)`}
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
        </>
      )}
    </div>
  );
}

export default App;
