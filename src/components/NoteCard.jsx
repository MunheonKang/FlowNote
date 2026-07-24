import React, { useState } from 'react';
import { Tag, Pencil, Trash2, Check, X } from 'lucide-react';

export default function NoteCard({ 
  note, 
  category, 
  openTabs, 
  formatDate,
  toggleComplete, 
  editCategory, 
  moveNote, 
  editContent, 
  deleteNote 
}) {
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [editContentValue, setEditContentValue] = useState(note.translation);

  const [isEditingCategory, setIsEditingCategory] = useState(false);
  const [editCategoryValue, setEditCategoryValue] = useState(category);

  const [isMovingTab, setIsMovingTab] = useState(false);
  const [newTabValue, setNewTabValue] = useState("");

  const handleContentSave = () => {
    editContent(note.id, editContentValue);
    setIsEditingContent(false);
  };

  const handleCategorySave = () => {
    editCategory(note.id, editCategoryValue);
    setIsEditingCategory(false);
  };

  const handleMoveTab = () => {
    if (newTabValue.trim()) {
      moveNote(note.id, newTabValue.trim());
      setIsMovingTab(false);
      setNewTabValue("");
    }
  };

  return (
    <div className="note-card">
      <div className="note-content">
        {category.toLowerCase() === 'todo' && (
          <input 
            type="checkbox" 
            className="todo-checkbox"
            checked={!!note.completed}
            onChange={() => toggleComplete(note.id, note.completed)}
          />
        )}
        
        {isEditingContent ? (
          <div className="inline-edit-container">
            <textarea 
              className="inline-edit-input" 
              value={editContentValue}
              onChange={(e) => setEditContentValue(e.target.value)}
              autoFocus
            />
            <div className="inline-edit-actions">
              <button className="btn-icon" onClick={handleContentSave}><Check size={14} className="text-green-500" /></button>
              <button className="btn-icon" onClick={() => setIsEditingContent(false)}><X size={14} className="text-red-500" /></button>
            </div>
          </div>
        ) : (
          <span className={note.completed ? 'completed-text' : ''}>
            {note.translation}
          </span>
        )}
      </div>
      
      <div className="note-meta">
        <span className="note-time">{formatDate(note.timestamp)}</span>
        <div className="note-actions">
          {/* Category Edit */}
          {isEditingCategory ? (
            <div className="inline-edit-container inline-small">
              <input 
                type="text" 
                className="inline-edit-input small-input" 
                value={editCategoryValue}
                onChange={(e) => setEditCategoryValue(e.target.value)}
                autoFocus
              />
              <button className="btn-icon" onClick={handleCategorySave}><Check size={12} /></button>
              <button className="btn-icon" onClick={() => setIsEditingCategory(false)}><X size={12} /></button>
            </div>
          ) : (
            <button className="btn-icon" onClick={() => setIsEditingCategory(true)} title="카테고리 수정">
              <Tag size={14} />
            </button>
          )}

          {/* Move Tab */}
          {isMovingTab ? (
             <div className="inline-edit-container inline-small">
               <input 
                 type="text" 
                 className="inline-edit-input small-input" 
                 placeholder="새 탭 이름..."
                 value={newTabValue}
                 onChange={(e) => setNewTabValue(e.target.value)}
                 autoFocus
               />
               <button className="btn-icon" onClick={handleMoveTab}><Check size={12} /></button>
               <button className="btn-icon" onClick={() => setIsMovingTab(false)}><X size={12} /></button>
             </div>
          ) : (
            <select
              className="btn-icon tab-select"
              value=""
              onChange={(e) => {
                if (e.target.value === 'new') {
                  setIsMovingTab(true);
                } else {
                  moveNote(note.id, e.target.value);
                }
              }}
              title="다른 탭으로 이동"
            >
              <option value="" disabled>이동 ▾</option>
              {openTabs.filter(t => t !== (note.tab || '기본 탭')).map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
              <option value="new">+ 새 탭 입력...</option>
            </select>
          )}

          <button className="btn-icon" onClick={() => setIsEditingContent(true)} title="내용 수정">
            <Pencil size={14} />
          </button>
          <button className="btn-icon btn-delete-icon" onClick={() => deleteNote(note.id)} title="노트 삭제">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
