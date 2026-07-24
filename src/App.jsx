import { useState, useMemo, useEffect } from 'react';
import { Sparkles, Send, LogIn, GripHorizontal, Check, X } from 'lucide-react';
import { useAuth } from './hooks/useAuth';
import { useNotes } from './hooks/useNotes';
import NoteCard from './components/NoteCard';
import SkeletonLoader from './components/SkeletonLoader';
import { collection, addDoc } from 'firebase/firestore';
import { db } from './firebase';
import './App.css';
import './components_styles.css'; // New styles

function App() {
  const { user, authLoading, login } = useAuth();
  
  const {
    notes,
    openTabs,
    activeTab,
    setActiveTab,
    notesLoading,
    tabsLoaded,
    closeTab,
    addNewTab,
    renameTab,
    handleTabReorder,
    deleteNote,
    toggleComplete,
    editCategory,
    moveNote,
    editContent
  } = useNotes(user);

  const [noteText, setNoteText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Add new tab inline edit state
  const [isAddingTab, setIsAddingTab] = useState(false);
  const [newTabName, setNewTabName] = useState("");

  // Rename tab inline edit state
  const [renamingTab, setRenamingTab] = useState(null); // stores the name of the tab being renamed
  const [renamingTabValue, setRenamingTabValue] = useState("");

  // 3. Performance Optimization with useMemo
  const categorizedNotes = useMemo(() => {
    return notes
      .filter(note => (note.tab || '기본 탭') === activeTab)
      .reduce((acc, note) => {
        const cat = note.category || 'Uncategorized';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(note);
        return acc;
      }, {});
  }, [notes, activeTab]);

  const activeNotesCount = notes.filter(note => (note.tab || '기본 탭') === activeTab).length;

  const processNote = async () => {
    if (!noteText.trim()) return;

    setIsProcessing(true);
    setErrorMessage('');

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteText })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to generate response');

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

  const handleDragStart = (e, index) => {
    e.dataTransfer.setData('tabIndex', index);
  };

  const handleDrop = (e, dropIndex) => {
    const dragIndex = Number(e.dataTransfer.getData('tabIndex'));
    handleTabReorder(dragIndex, dropIndex);
  };

  const handleDragOver = (e) => e.preventDefault();

  if (authLoading) return <div className="app-container"></div>;

  return (
    <div className="app-container">
      {!user ? (
        <main className="main-content">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '2rem', padding: '2rem', textAlign: 'center' }}>
            <h2 style={{ color: '#e2e8f0', margin: 0, fontSize: '1.8rem' }}>나만의 비밀 노트</h2>
            <p style={{ color: '#94a3b8', margin: 0 }}>메모를 보호하려면 구글 계정으로 안전하게 로그인하세요.</p>
            <button onClick={login} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.8rem 1.5rem', background: '#e2e8f0', color: '#0f0f11', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
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
                  onClick={() => {
                    if (renamingTab !== tab) setActiveTab(tab);
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setRenamingTab(tab);
                    setRenamingTabValue(tab);
                  }}
                  draggable={renamingTab !== tab}
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, index)}
                >
                  <GripHorizontal size={14} className="drag-handle" style={{ cursor: 'grab', opacity: 0.5 }} />
                  
                  {renamingTab === tab ? (
                    <div className="inline-edit-container inline-small" onClick={e => e.stopPropagation()}>
                      <input 
                        type="text" 
                        className="inline-edit-input small-input" 
                        value={renamingTabValue}
                        onChange={(e) => setRenamingTabValue(e.target.value)}
                        autoFocus
                      />
                      <button className="btn-icon" onClick={() => {
                        renameTab(tab, renamingTabValue);
                        setRenamingTab(null);
                      }}><Check size={12} /></button>
                      <button className="btn-icon" onClick={() => setRenamingTab(null)}><X size={12} /></button>
                    </div>
                  ) : (
                    <>
                      {tab}
                      {openTabs.length > 1 && (
                        <span className="close-tab" onClick={(e) => closeTab(e, tab)}>×</span>
                      )}
                    </>
                  )}
                </div>
              ))}
              
              {isAddingTab ? (
                 <div className="tab">
                   <div className="inline-edit-container inline-small">
                      <input 
                        type="text" 
                        className="inline-edit-input small-input" 
                        placeholder="탭 이름..."
                        value={newTabName}
                        onChange={(e) => setNewTabName(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            addNewTab(newTabName);
                            setIsAddingTab(false);
                            setNewTabName('');
                          }
                        }}
                      />
                      <button className="btn-icon" onClick={() => {
                        addNewTab(newTabName);
                        setIsAddingTab(false);
                        setNewTabName('');
                      }}><Check size={12} /></button>
                      <button className="btn-icon" onClick={() => {
                        setIsAddingTab(false);
                        setNewTabName('');
                      }}><X size={12} /></button>
                    </div>
                 </div>
              ) : (
                <div className="tab add-tab-btn" onClick={() => setIsAddingTab(true)}>
                  + 새 탭
                </div>
              )}
            </div>

            <section className="notes-list">
              {/* 4. Skeleton Loader UI */}
              {notesLoading ? (
                <SkeletonLoader />
              ) : activeNotesCount === 0 ? (
                <div className="empty-state">
                  작성된 메모가 없습니다. 아래에 첫 메모를 남겨보세요!
                </div>
              ) : (
                Object.entries(categorizedNotes).map(([category, categoryNotes]) => (
                  <div key={category} className="category-group">
                    <h2 className="category-title">{category}</h2>
                    <div className="category-items">
                      {categoryNotes.map(note => (
                        <NoteCard 
                          key={note.id}
                          note={note}
                          category={category}
                          openTabs={openTabs}
                          formatDate={formatDate}
                          toggleComplete={toggleComplete}
                          editCategory={editCategory}
                          moveNote={moveNote}
                          editContent={editContent}
                          deleteNote={deleteNote}
                        />
                      ))}
                    </div>
                  </div>
                ))
              )}
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
