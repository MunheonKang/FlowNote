import { useState, useEffect } from 'react';
import { collection, query, orderBy, where, onSnapshot, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

export function useNotes(user) {
  const [notes, setNotes] = useState([]);
  const [openTabs, setOpenTabs] = useState(['기본 탭']);
  const [activeTab, setActiveTab] = useState('기본 탭');
  const [tabsLoaded, setTabsLoaded] = useState(false);
  const [notesLoading, setNotesLoading] = useState(true);

  // 1. Fetch data
  useEffect(() => {
    if (!user) {
      setNotes([]);
      setOpenTabs(['기본 탭']);
      setTabsLoaded(false);
      setNotesLoading(true);
      return;
    }

    setNotesLoading(true);
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
      setNotesLoading(false);
    }, (error) => {
      console.error("Firestore error:", error);
      setNotesLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // 2. Sync active tab
  useEffect(() => {
    if (tabsLoaded && !openTabs.includes(activeTab)) {
      setActiveTab(openTabs[0] || '기본 탭');
    }
  }, [openTabs, activeTab, tabsLoaded]);

  // 3. Tab management functions
  const updateTabsInDb = async (newTabs) => {
    if (!user) return;
    setOpenTabs(newTabs); // Optimistic UI
    try {
      await setDoc(doc(db, 'notes', `settings_${user.uid}`), { 
        isSettings: true, 
        uid: user.uid, 
        tabs: newTabs,
        timestamp: new Date(0).toISOString()
      }, { merge: true });
    } catch (err) {
      console.error("Error updating tabs:", err);
    }
  };

  const closeTab = (e, cat) => {
    e.stopPropagation();
    if (openTabs.length <= 1) return;
    const newTabs = openTabs.filter(t => t !== cat);
    updateTabsInDb(newTabs);
  };

  const addNewTab = (tabName) => {
    if (tabName && tabName.trim() !== "" && !openTabs.includes(tabName.trim())) {
      const newTabs = [...openTabs, tabName.trim()];
      updateTabsInDb(newTabs);
      setActiveTab(tabName.trim());
    }
  };

  const renameTab = async (oldName, newName) => {
    if (!newName || newName.trim() === "" || newName === oldName) return;
    
    const trimmedName = newName.trim();
    if (openTabs.includes(trimmedName)) {
      alert("이미 존재하는 탭 이름입니다.");
      return;
    }

    const newTabs = openTabs.map(t => t === oldName ? trimmedName : t);
    updateTabsInDb(newTabs);

    if (activeTab === oldName) {
      setActiveTab(trimmedName);
    }

    const notesToUpdate = notes.filter(n => (n.tab || '기본 탭') === oldName);
    for (const note of notesToUpdate) {
      try {
        await updateDoc(doc(db, 'notes', note.id), { tab: trimmedName });
      } catch (e) {
        console.error("Failed to update note tab:", e);
      }
    }
  };

  const handleTabReorder = (dragIndex, dropIndex) => {
    if (dragIndex === dropIndex) return;
    const newTabs = [...openTabs];
    const [draggedTab] = newTabs.splice(dragIndex, 1);
    newTabs.splice(dropIndex, 0, draggedTab);
    updateTabsInDb(newTabs);
  };

  // 4. Note management functions
  const deleteNote = async (id) => {
    try {
      await deleteDoc(doc(db, 'notes', id));
    } catch (err) {
      console.error("Error deleting note:", err);
    }
  };

  const toggleComplete = async (id, currentStatus) => {
    try {
      await updateDoc(doc(db, 'notes', id), { completed: !currentStatus });
    } catch (err) {
      console.error("Error updating note:", err);
    }
  };

  const editCategory = async (id, newCategory) => {
    if (newCategory && newCategory.trim() !== "") {
      try {
        await updateDoc(doc(db, 'notes', id), { category: newCategory.trim() });
      } catch (err) {
        console.error("Error updating category:", err);
      }
    }
  };

  const moveNote = async (id, newTab) => {
    if (newTab) {
      try {
        await updateDoc(doc(db, 'notes', id), { tab: newTab });
        if (!openTabs.includes(newTab)) {
          updateTabsInDb([...openTabs, newTab]);
        }
      } catch (err) {
        console.error("Error updating tab:", err);
      }
    }
  };

  const editContent = async (id, newContent) => {
    if (newContent && newContent.trim() !== "") {
      try {
        await updateDoc(doc(db, 'notes', id), { translation: newContent.trim() });
      } catch (err) {
        console.error("Error updating content:", err);
      }
    }
  };

  return {
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
  };
}
