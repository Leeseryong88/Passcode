import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isCurrentUserAdmin, onAuthStateChangedListener, signInWithEmailPassword, signOutCurrentUser } from '../firebase';
import { uploadImageAdminCallable } from '../firebase';
import { getAllPuzzlesAdmin, createPuzzleAdmin, updatePuzzleAdmin, deletePuzzleAdmin } from '../api/puzzles';
import type { PublicPuzzle } from '../types';
import { adminFetchBoardPosts, adminUpdateBoardPost, adminDeleteBoardPost } from '../api/board';

type AdminPuzzle = PublicPuzzle & { answer?: string; recoveryPhrase?: string; docId?: string };

const AdminApp: React.FC = () => {
  const { t } = useTranslation();
  const [isAuthed, setIsAuthed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminTab, setAdminTab] = useState<'puzzles' | 'board'>('puzzles');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [puzzles, setPuzzles] = useState<AdminPuzzle[]>([]);
  const [loading, setLoading] = useState(false);
  // Board admin state
  const [boardPosts, setBoardPosts] = useState<any[]>([]);
  const [loadingBoard, setLoadingBoard] = useState(false);
  const [isBoardEditOpen, setIsBoardEditOpen] = useState(false);
  const [boardEditDraft, setBoardEditDraft] = useState<any | null>(null);
  const [newPuzzle, setNewPuzzle] = useState<any>({
    id: '',
    imageUrl: '',
    walletaddress: '',
    rewardAmount: '',
    explorerLink: '',
    answer: '',
    recoveryPhrase: '',
    isSolved: false,
    isPublished: false,
    rewardType: 'metamask',
    revealImageUrl: '',
    puzzleName: '',
  });

  // Edit modal state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editDraft, setEditDraft] = useState<AdminPuzzle | null>(null);

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const commaIdx = result.indexOf(',');
        resolve(commaIdx >= 0 ? result.substring(commaIdx + 1) : result);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  };

  const uploadFileAndGetUrl = async (file: File, pathPrefix: string) => {
    const base64 = await readFileAsBase64(file);
    const ext = (file.name.match(/\.[a-zA-Z0-9]+$/)?.[0] || '').toLowerCase();
    const rand = crypto.getRandomValues(new Uint8Array(16));
    const hex = Array.from(rand).map(b => b.toString(16).padStart(2, '0')).join('');
    const serverPath = `${pathPrefix}/${hex}${ext}`;
    const result = await uploadImageAdminCallable({ path: serverPath, contentType: file.type || 'application/octet-stream', base64 });
    const data = result.data as any;
    if (!data?.url) {
      throw new Error('Server upload failed');
    }
    if (pathPrefix === 'puzzles') {
      setNewPuzzle((s: any) => ({ ...s, imagePath: serverPath }));
    } else if (pathPrefix === 'rewards') {
      setNewPuzzle((s: any) => ({ ...s, revealImagePath: serverPath }));
    }
    return data.url as string;
  };
  

  useEffect(() => {
    const unsub = onAuthStateChangedListener(async (user) => {
      setIsAuthed(Boolean(user));
      const admin = await isCurrentUserAdmin();
      setIsAdmin(admin);
      if (user && admin) {
        void fetchPuzzles();
        void fetchBoardAdmin();
      } else {
        setPuzzles([]);
        setBoardPosts([]);
      }
    });
    return () => unsub();
  }, []);

  // Auto-generate next id when puzzle list changes
  useEffect(() => {
    const nextId = (puzzles.length ? Math.max(...puzzles.map(p => Number((p as any).id) || 0)) : 0) + 1;
    setNewPuzzle((s: any) => ({ ...s, id: String(nextId) }));
  }, [puzzles]);

  const fetchPuzzles = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAllPuzzlesAdmin();
      setPuzzles(data as AdminPuzzle[]);
    } catch (e: any) {
      setError(e.message || 'Failed to load puzzles');
    } finally {
      setLoading(false);
    }
  };

  const fetchBoardAdmin = async () => {
    setLoadingBoard(true);
    setError(null);
    try {
      const data = await adminFetchBoardPosts(100);
      setBoardPosts((data.items ?? data) as any[]);
    } catch (e: any) {
      setError(e.message || 'Failed to load board posts');
    } finally {
      setLoadingBoard(false);
    }
  };

  const openEdit = (p: AdminPuzzle) => {
    setEditDraft({ ...p } as AdminPuzzle);
    setIsEditOpen(true);
  };

  const closeEdit = () => {
    setIsEditOpen(false);
    setEditDraft(null);
  };

  const handleEditFieldChange = (field: string, value: any) => {
    setEditDraft((prev) => (prev ? { ...(prev as any), [field]: value } as any : prev));
  };

  const handleSaveEdit = async () => {
    if (!editDraft) return;
    setError(null);
    try {
      const payload: any = { ...editDraft };
      // Ensure proper types
      payload.id = Number(payload.id);
      if (typeof (payload as any).wrongAttempts !== 'undefined') {
        payload.wrongAttempts = Number((payload as any).wrongAttempts);
      }
      await updatePuzzleAdmin(payload);
      closeEdit();
      await fetchPuzzles();
    } catch (e: any) {
      setError(e.message || 'Update failed');
    }
  };

  const handleDeleteEdit = async () => {
    if (!editDraft) return;
    setError(null);
    try {
      await deletePuzzleAdmin(editDraft.id);
      closeEdit();
      await fetchPuzzles();
    } catch (e: any) {
      setError(e.message || 'Delete failed');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await signInWithEmailPassword(email, password);
      const admin = await isCurrentUserAdmin();
      setIsAdmin(admin);
      if (!admin) setError(t('admin_only'));
    } catch (e: any) {
      setError(e.message || 'Login failed');
    }
  };

  const handleLogout = async () => {
    await signOutCurrentUser();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const payload = {
        ...newPuzzle,
        id: Number(newPuzzle.id),
        isPublished: Boolean(newPuzzle.isPublished),
      };
      await createPuzzleAdmin(payload);
      setNewPuzzle({ id: '', imageUrl: '', walletaddress: '', rewardAmount: '', explorerLink: '', answer: '', recoveryPhrase: '', isSolved: false, isPublished: false, rewardType: 'metamask', revealImageUrl: '', puzzleName: '' });
      await fetchPuzzles();
    } catch (e: any) {
      setError(e.message || 'Create failed');
    }
  };

  // legacy handlers removed in favor of modal-based edit

  

  if (!isAuthed || !isAdmin) {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-100 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-gray-800 border border-gray-700 rounded-xl p-6">
          <h2 className="text-xl font-bold mb-4">{t('admin_login')}</h2>
          {error && <div className="mb-3 text-sm text-red-400">{error}</div>}
          <form onSubmit={handleLogin} className="space-y-3">
            <input className="w-full px-3 py-2 bg-gray-700 rounded" placeholder={t('email') || 'Email'} value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className="w-full px-3 py-2 bg-gray-700 rounded" placeholder={t('password') || 'Password'} type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button className="w-full bg-cyan-600 hover:bg-cyan-700 py-2 rounded font-semibold">{t('login')}</button>
          </form>
          
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <div className="container mx-auto p-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">{t('admin_panel')}</h1>
          <button onClick={handleLogout} className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded">{t('logout')}</button>
        </div>
        {/* Tabs */}
        <div className="mb-4 inline-flex rounded-lg border border-gray-700 overflow-hidden">
          <button className={`${adminTab==='puzzles' ? 'bg-cyan-600 text-white' : 'bg-gray-800 text-gray-300'} px-4 py-2`} onClick={() => setAdminTab('puzzles')}>퍼즐</button>
          <button className={`${adminTab==='board' ? 'bg-cyan-600 text-white' : 'bg-gray-800 text-gray-300'} px-4 py-2 border-l border-gray-700`} onClick={() => setAdminTab('board')}>게시판</button>
        </div>
        {error && <div className="mb-3 text-sm text-red-400">{error}</div>}
        {adminTab === 'puzzles' ? (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold">{t('puzzle_list')}</h2>
                <button onClick={fetchPuzzles} className="text-sm bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded">Reload</button>
              </div>
              {loading ? (
                <div>Loading...</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {puzzles.map((p) => (
                    <div key={p.id} className={`relative bg-gray-800 border ${p.isSolved ? 'border-green-500/50' : 'border-gray-700'} rounded-xl shadow-lg overflow-hidden transition-colors duration-200 hover:shadow-cyan-500/10 cursor-pointer`} onClick={() => openEdit(p)}>
                      {p.isSolved && (
                        <span className="absolute top-2 left-2 text-xs font-semibold bg-green-700/70 text-green-100 px-2 py-0.5 rounded">Solved</span>
                      )}
                      <img src={p.imageUrl} alt={`puzzle`} className="w-full h-36 object-cover" />
                      <div className="p-3 space-y-2">
                        <div className="flex items-center justify-end">
                          <span className="text-xs font-semibold bg-yellow-600/20 text-yellow-300 px-2 py-0.5 rounded">{p.rewardAmount}</span>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs">
                          <span className={`px-2 py-0.5 rounded ${p.isPublished ? 'bg-blue-600/20 text-blue-300' : 'bg-gray-600/20 text-gray-300'}`}>{p.isPublished ? 'Published' : 'Unpublished'}</span>
                          <span className="px-2 py-0.5 rounded bg-purple-600/20 text-purple-300">{(p as any).rewardType || 'metamask'}</span>
                          <span className="px-2 py-0.5 rounded bg-red-600/20 text-red-300">{t('wrong_attempts_count', { count: (p as any).wrongAttempts || 0 })}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
              <h2 className="font-semibold mb-3">{t('new_puzzle')}</h2>
              <form onSubmit={handleCreate} className="space-y-2">
              <input className="w-full px-3 py-2 bg-gray-700 rounded" placeholder="id" value={newPuzzle.id} onChange={(e) => setNewPuzzle((s: any) => ({ ...s, id: e.target.value }))} />
              <div className="flex items-center gap-2">
                <input type="checkbox" id="isPublished" checked={Boolean(newPuzzle.isPublished)} onChange={(e) => setNewPuzzle((s: any) => ({...s, isPublished: e.target.checked}))} />
                <label htmlFor="isPublished">Publish on create</label>
              </div>
              <input className="w-full px-3 py-2 bg-gray-700 rounded" placeholder="imageUrl" value={newPuzzle.imageUrl} onChange={(e) => setNewPuzzle((s: any) => ({ ...s, imageUrl: e.target.value }))} />
              <input type="file" accept="image/*" className="w-full" onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setLoading(true);
                try {
                  const url = await uploadFileAndGetUrl(file, 'puzzles');
                  setNewPuzzle((s: any) => ({ ...s, imageUrl: url }));
                } catch (err:any) { setError(err.message || 'Upload failed'); }
                finally { setLoading(false); }
              }} />
              <select className="w-full px-3 py-2 bg-gray-700 rounded" value={newPuzzle.rewardType} onChange={(e) => setNewPuzzle((s: any) => ({ ...s, rewardType: e.target.value }))}>
                <option value="metamask">Metamask</option>
                <option value="image">Image</option>
                <option value="text">Text</option>
              </select>
              <input className="w-full px-3 py-2 bg-gray-700 rounded" placeholder="puzzleType (e.g., cipher, logic, image, riddle)" value={(newPuzzle as any).puzzleType || ''} onChange={(e) => setNewPuzzle((s: any) => ({ ...s, puzzleType: e.target.value }))} />
              <input className="w-full px-3 py-2 bg-gray-700 rounded" placeholder="puzzleName (카드 상단에 표시될 이름)" value={(newPuzzle as any).puzzleName || ''} onChange={(e) => setNewPuzzle((s: any) => ({ ...s, puzzleName: e.target.value }))} />
              {newPuzzle.rewardType === 'metamask' && (
                <input className="w-full px-3 py-2 bg-gray-700 rounded" placeholder="walletaddress" value={newPuzzle.walletaddress} onChange={(e) => setNewPuzzle((s: any) => ({ ...s, walletaddress: e.target.value }))} />
              )}
              <input className="w-full px-3 py-2 bg-gray-700 rounded" placeholder="rewardAmount" value={newPuzzle.rewardAmount} onChange={(e) => setNewPuzzle((s: any) => ({ ...s, rewardAmount: e.target.value }))} />
              {newPuzzle.rewardType === 'metamask' && (
                <input className="w-full px-3 py-2 bg-gray-700 rounded" placeholder="explorerLink" value={newPuzzle.explorerLink} onChange={(e) => setNewPuzzle((s: any) => ({ ...s, explorerLink: e.target.value }))} />
              )}
              <input className="w-full px-3 py-2 bg-gray-700 rounded" placeholder="answer" value={newPuzzle.answer} onChange={(e) => setNewPuzzle((s: any) => ({ ...s, answer: e.target.value }))} />
              {newPuzzle.rewardType === 'metamask' && (
                <input className="w-full px-3 py-2 bg-gray-700 rounded" placeholder="recoveryPhrase" value={newPuzzle.recoveryPhrase} onChange={(e) => setNewPuzzle((s: any) => ({ ...s, recoveryPhrase: e.target.value }))} />
              )}
              {newPuzzle.rewardType === 'image' && (
                <>
                  <input className="w-full px-3 py-2 bg-gray-700 rounded" placeholder="revealImageUrl" value={newPuzzle.revealImageUrl} onChange={(e) => setNewPuzzle((s: any) => ({ ...s, revealImageUrl: e.target.value }))} />
                  <input type="file" accept="image/*" className="w-full" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setLoading(true);
                    try {
                      const url = await uploadFileAndGetUrl(file, 'rewards');
                      setNewPuzzle((s: any) => ({ ...s, revealImageUrl: url }));
                    } catch (err:any) { setError(err.message || 'Upload failed'); }
                    finally { setLoading(false); }
                  }} />
                </>
              )}
              {newPuzzle.rewardType === 'text' && (
                <textarea className="w-full px-3 py-2 bg-gray-700 rounded" placeholder="revealText" value={(newPuzzle as any).revealText || ''} onChange={(e) => setNewPuzzle((s: any) => ({ ...s, revealText: e.target.value }))} />
              )}
                <button className="w-full bg-cyan-600 hover:bg-cyan-700 py-2 rounded font-semibold">{t('create')}</button>
              </form>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold">게시판 글 관리</h2>
              <button onClick={fetchBoardAdmin} className="text-sm bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded">Reload</button>
            </div>
            {loadingBoard ? (
              <div>Loading...</div>
            ) : (
              <div className="space-y-2">
                {boardPosts.map((bp) => (
                  <div key={bp.id} className="p-3 bg-gray-800 border border-gray-700 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {bp.isPinned && <span className="px-2 py-0.5 text-xs rounded bg-yellow-700/30 text-yellow-300">PIN</span>}
                      <span className="text-sm px-2 py-0.5 rounded bg-gray-700 text-gray-300">{bp.category || '일반'}</span>
                      <span className="font-semibold">{bp.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="text-sm bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded" onClick={() => { setBoardEditDraft({ ...bp }); setIsBoardEditOpen(true); }}>편집</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {/* Puzzle Edit Modal */}
        {isEditOpen && editDraft && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={closeEdit}>
            <div className="w-full max-w-2xl bg-gray-800 border border-gray-700 rounded-xl p-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">Edit Puzzle #{editDraft.id}</h3>
                <button className="text-sm bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded" onClick={closeEdit}>Close</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="text-xs opacity-80">ID
                  <input className="w-full px-3 py-2 bg-gray-800 rounded opacity-70 cursor-not-allowed" value={String(editDraft.id)} disabled />
                </label>
                <label className="text-xs opacity-80">Published
                  <select className="w-full px-3 py-2 bg-gray-700 rounded" value={String(Boolean(editDraft.isPublished))} onChange={(e) => handleEditFieldChange('isPublished', e.target.value === 'true')}>
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                </label>
                <label className="text-xs opacity-80">Solved
                  <select className="w-full px-3 py-2 bg-gray-700 rounded" value={String(editDraft.isSolved || false)} onChange={(e) => handleEditFieldChange('isSolved', e.target.value === 'true')}>
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                </label>
                <label className="text-xs opacity-80">Reward Type
                  <select className="w-full px-3 py-2 bg-gray-700 rounded" value={(editDraft as any).rewardType || 'metamask'} onChange={(e) => handleEditFieldChange('rewardType', e.target.value)}>
                    <option value="metamask">metamask</option>
                    <option value="image">image</option>
                    <option value="text">text</option>
                  </select>
                </label>
                <label className="text-xs opacity-80">Image URL
                  <input className="w-full px-3 py-2 bg-gray-700 rounded" value={editDraft.imageUrl} onChange={(e) => handleEditFieldChange('imageUrl', e.target.value)} />
                </label>
                <label className="text-xs opacity-80">Puzzle Type
                  <input className="w-full px-3 py-2 bg-gray-700 rounded" value={(editDraft as any).puzzleType || ''} onChange={(e) => handleEditFieldChange('puzzleType', e.target.value)} />
                </label>
                <label className="text-xs opacity-80">Puzzle Name
                  <input className="w-full px-3 py-2 bg-gray-700 rounded" value={(editDraft as any).puzzleName || ''} onChange={(e) => handleEditFieldChange('puzzleName', e.target.value)} />
                </label>
                <label className="text-xs opacity-80">Image Path
                  <input className="w-full px-3 py-2 bg-gray-700 rounded" value={(editDraft as any).imagePath || ''} onChange={(e) => handleEditFieldChange('imagePath', e.target.value)} />
                </label>
                {(editDraft as any).rewardType === 'metamask' && (
                  <label className="text-xs opacity-80">Wallet
                    <input className="w-full px-3 py-2 bg-gray-700 rounded" value={editDraft.walletaddress} onChange={(e) => handleEditFieldChange('walletaddress', e.target.value)} />
                  </label>
                )}
                <label className="text-xs opacity-80">Reward Amount
                  <input className="w-full px-3 py-2 bg-gray-700 rounded" value={editDraft.rewardAmount} onChange={(e) => handleEditFieldChange('rewardAmount', e.target.value)} />
                </label>
                {(editDraft as any).rewardType === 'metamask' && (
                  <label className="text-xs opacity-80">Explorer Link
                    <input className="w-full px-3 py-2 bg-gray-700 rounded" value={editDraft.explorerLink} onChange={(e) => handleEditFieldChange('explorerLink', e.target.value)} />
                  </label>
                )}
                <label className="text-xs opacity-80">Answer
                  <input className="w-full px-3 py-2 bg-gray-700 rounded" value={(editDraft as any).answer || ''} onChange={(e) => handleEditFieldChange('answer', e.target.value)} />
                </label>
                {(editDraft as any).rewardType === 'metamask' && (
                  <label className="text-xs opacity-80">Recovery Phrase
                    <input className="w-full px-3 py-2 bg-gray-700 rounded" value={(editDraft as any).recoveryPhrase || ''} onChange={(e) => handleEditFieldChange('recoveryPhrase', e.target.value)} />
                  </label>
                )}
                {(editDraft as any).rewardType === 'image' && (
                  <label className="text-xs opacity-80">Reveal Image URL
                    <input className="w-full px-3 py-2 bg-gray-700 rounded" value={(editDraft as any).revealImageUrl || ''} onChange={(e) => handleEditFieldChange('revealImageUrl', e.target.value)} />
                  </label>
                )}
                {(editDraft as any).rewardType === 'text' && (
                  <label className="text-xs opacity-80">Reveal Text
                    <textarea className="w-full px-3 py-2 bg-gray-700 rounded" value={(editDraft as any).revealText || ''} onChange={(e) => handleEditFieldChange('revealText', e.target.value)} />
                  </label>
                )}
                {(editDraft as any).rewardType === 'image' && (
                  <label className="text-xs opacity-80">Reveal Image Path
                    <input className="w-full px-3 py-2 bg-gray-700 rounded" value={(editDraft as any).revealImagePath || ''} onChange={(e) => handleEditFieldChange('revealImagePath', e.target.value)} />
                  </label>
                )}
                <label className="text-xs opacity-80">Total Attempts
                  <input className="w-full px-3 py-2 bg-gray-700 rounded" type="number" value={(editDraft as any).wrongAttempts || 0} onChange={(e) => handleEditFieldChange('wrongAttempts', e.target.value)} />
                </label>
                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="text-xs opacity-80">Solver Name
                    <input className="w-full px-3 py-2 bg-gray-700 rounded" value={(editDraft as any).solverName || ''} onChange={(e) => handleEditFieldChange('solverName', e.target.value)} />
                  </label>
                  <div className="flex items-end">
                    <button className="bg-red-700 hover:bg-red-600 px-3 py-2 rounded text-sm" onClick={() => handleEditFieldChange('solverName', '')}>Clear Solver Name</button>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-end gap-2">
                <button className="bg-red-700 hover:bg-red-600 px-3 py-2 rounded text-sm" onClick={handleDeleteEdit}>{t('delete')}</button>
                <button className="bg-green-700 hover:bg-green-600 px-3 py-2 rounded text-sm" onClick={handleSaveEdit}>{t('save')}</button>
              </div>
            </div>
          </div>
        )}

        {/* Board Edit Modal */}
        {isBoardEditOpen && boardEditDraft && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setIsBoardEditOpen(false)}>
            <div className="w-full max-w-2xl bg-gray-800 border border-gray-700 rounded-xl p-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">게시글 편집</h3>
                <button className="text-sm bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded" onClick={() => setIsBoardEditOpen(false)}>Close</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="text-xs opacity-80">ID
                  <input className="w-full px-3 py-2 bg-gray-800 rounded opacity-70 cursor-not-allowed" value={String(boardEditDraft.id)} disabled />
                </label>
                <label className="text-xs opacity-80">분류
                  <select className="w-full px-3 py-2 bg-gray-700 rounded" value={String(boardEditDraft.category || '일반')} onChange={(e) => setBoardEditDraft((s:any) => ({ ...s, category: e.target.value }))}>
                    <option value="일반">일반</option>
                    <option value="퍼즐">퍼즐</option>
                  </select>
                </label>
                <label className="text-xs opacity-80 md:col-span-2">제목
                  <input className="w-full px-3 py-2 bg-gray-700 rounded" value={boardEditDraft.title || ''} onChange={(e) => setBoardEditDraft((s:any) => ({ ...s, title: e.target.value }))} />
                </label>
                <label className="text-xs opacity-80 md:col-span-2">내용
                  <textarea className="w-full px-3 py-2 bg-gray-700 rounded" rows={8} value={boardEditDraft.content || ''} onChange={(e) => setBoardEditDraft((s:any) => ({ ...s, content: e.target.value }))} />
                </label>
                <label className="text-xs opacity-80 flex items-center gap-2 md:col-span-2">
                  <input type="checkbox" checked={Boolean(boardEditDraft.isPinned)} onChange={(e) => setBoardEditDraft((s:any) => ({ ...s, isPinned: e.target.checked }))} />
                  <span>상단 고정</span>
                </label>
              </div>
              <div className="mt-4 flex items-center justify-end gap-2">
                <button className="bg-red-700 hover:bg-red-600 px-3 py-2 rounded text-sm" onClick={async () => { try { await adminDeleteBoardPost(String(boardEditDraft.id)); setIsBoardEditOpen(false); await fetchBoardAdmin(); } catch (e:any) { setError(e.message || 'Delete failed'); } }}>삭제</button>
                <button className="bg-green-700 hover:bg-green-600 px-3 py-2 rounded text-sm" onClick={async () => { try { await adminUpdateBoardPost({ id: String(boardEditDraft.id), title: boardEditDraft.title, content: boardEditDraft.content, category: boardEditDraft.category, isPinned: Boolean(boardEditDraft.isPinned) }); setIsBoardEditOpen(false); await fetchBoardAdmin(); } catch (e:any) { setError(e.message || 'Save failed'); } }}>저장</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminApp;


