import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isCurrentUserAdmin, onAuthStateChangedListener, signInWithEmailPassword, signOutCurrentUser } from '../firebase';
import { uploadImageAdminCallable } from '../firebase';
import { getAllPuzzlesAdmin, createPuzzleAdmin, updatePuzzleAdmin, deletePuzzleAdmin, grantAdminRole } from '../api/puzzles';
import type { PublicPuzzle } from '../types';

type AdminPuzzle = PublicPuzzle & { answer?: string; recoveryPhrase?: string; docId?: string };

const AdminApp: React.FC = () => {
  const { t } = useTranslation();
  const [isAuthed, setIsAuthed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [puzzles, setPuzzles] = useState<AdminPuzzle[]>([]);
  const [loading, setLoading] = useState(false);
  const [newPuzzle, setNewPuzzle] = useState<any>({
    id: '',
    level: '',
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
  });

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
  const [grantEmail, setGrantEmail] = useState('');
  const [grantSecret, setGrantSecret] = useState('');

  useEffect(() => {
    const unsub = onAuthStateChangedListener(async (user) => {
      setIsAuthed(Boolean(user));
      const admin = await isCurrentUserAdmin();
      setIsAdmin(admin);
      if (user && admin) {
        void fetchPuzzles();
      } else {
        setPuzzles([]);
      }
    });
    return () => unsub();
  }, []);

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
        level: Number(newPuzzle.level),
        isPublished: Boolean(newPuzzle.isPublished),
      };
      await createPuzzleAdmin(payload);
      setNewPuzzle({ id: '', level: '', imageUrl: '', walletaddress: '', rewardAmount: '', explorerLink: '', answer: '', recoveryPhrase: '', isSolved: false, isPublished: false, rewardType: 'metamask', revealImageUrl: '' });
      await fetchPuzzles();
    } catch (e: any) {
      setError(e.message || 'Create failed');
    }
  };

  const handleUpdate = async (puzzleId: number) => {
    setError(null);
    try {
      const puzzleToUpdate = puzzles.find(p => p.id === puzzleId);
      if (!puzzleToUpdate) {
        throw new Error("Puzzle not found in local state");
      }
      await updatePuzzleAdmin(puzzleToUpdate);
      await fetchPuzzles();
    } catch (e: any) {
      setError(e.message || 'Update failed');
    }
  };

  const handleDelete = async (id: number) => {
    setError(null);
    try {
      await deletePuzzleAdmin(id);
      await fetchPuzzles();
    } catch (e: any) {
      setError(e.message || 'Delete failed');
    }
  };

  const handleFieldChange = (id: number, field: string, value: any) => {
    setPuzzles(prev => prev.map(p => (p.id === id ? { ...p, [field]: value } : p)));
  };

  const handleGrantAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await grantAdminRole(grantEmail, grantSecret);
      setGrantEmail('');
      setGrantSecret('');
      alert('Granted admin role');
    } catch (e: any) {
      setError(e.message || 'Grant admin failed');
    }
  };

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
          <div className="mt-6 border-t border-gray-700 pt-4">
            <h3 className="font-semibold mb-2">{t('grant_admin')}</h3>
            <form onSubmit={handleGrantAdmin} className="space-y-2">
              <input className="w-full px-3 py-2 bg-gray-700 rounded" placeholder={t('email') || 'Email'} value={grantEmail} onChange={(e) => setGrantEmail(e.target.value)} />
              <input className="w-full px-3 py-2 bg-gray-700 rounded" placeholder={t('secret') || 'Secret'} value={grantSecret} onChange={(e) => setGrantSecret(e.target.value)} />
              <button className="w-full bg-yellow-600 hover:bg-yellow-700 py-2 rounded font-semibold">{t('grant_admin')}</button>
            </form>
          </div>
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
        {error && <div className="mb-3 text-sm text-red-400">{error}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-gray-800 border border-gray-700 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">{t('puzzle_list')}</h2>
              <button onClick={fetchPuzzles} className="text-sm bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded">Reload</button>
            </div>
            {loading ? (
              <div>Loading...</div>
            ) : (
              <div className="space-y-3">
                {puzzles.map((p) => (
                  <div key={p.id} className="p-3 bg-gray-900 rounded border border-gray-700">
                    <div className="flex flex-wrap gap-2 items-center justify-between">
                      <div className="font-semibold">#{p.id} L{p.level}</div>
                      <div className="text-sm">{p.isSolved ? t('solved') : t('unsolved')}</div>
                      <div className="text-sm font-semibold">{p.isPublished ? 'Published' : 'Unpublished'}</div>
                      <div className="flex gap-2">
                        <button className="text-sm bg-blue-700 hover:bg-blue-600 px-3 py-1 rounded" onClick={() => handleFieldChange(p.id, 'isSolved', !p.isSolved)}>
                          Toggle Solved
                        </button>
                        <button className="text-sm bg-yellow-700 hover:bg-yellow-600 px-3 py-1 rounded" onClick={() => handleFieldChange(p.id, 'isPublished', !p.isPublished)}>
                          Toggle Published
                        </button>
                        <button className="text-sm bg-red-700 hover:bg-red-600 px-3 py-1 rounded" onClick={() => handleDelete(p.id)}>
                          {t('delete')}
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                      <label className="text-xs opacity-70">Reward Type
                        <select className="w-full px-2 py-1 bg-gray-800 rounded" value={(p as any).rewardType || 'metamask'} onChange={(e) => handleFieldChange(p.id, 'rewardType', e.target.value)}>
                          <option value="metamask">Metamask</option>
                          <option value="image">Image</option>
                        </select>
                      </label>
                      <label className="text-xs opacity-70">Image URL
                        <input className="w-full px-2 py-1 bg-gray-800 rounded" value={p.imageUrl} onChange={(e) => handleFieldChange(p.id, 'imageUrl', e.target.value)} />
                      </label>
                      <label className="text-xs opacity-70">Wallet
                        <input className="w-full px-2 py-1 bg-gray-800 rounded" value={p.walletaddress} onChange={(e) => handleFieldChange(p.id, 'walletaddress', e.target.value)} />
                      </label>
                      <label className="text-xs opacity-70">Reward
                        <input className="w-full px-2 py-1 bg-gray-800 rounded" value={p.rewardAmount} onChange={(e) => handleFieldChange(p.id, 'rewardAmount', e.target.value)} />
                      </label>
                      <label className="text-xs opacity-70">Explorer
                        <input className="w-full px-2 py-1 bg-gray-800 rounded" value={p.explorerLink} onChange={(e) => handleFieldChange(p.id, 'explorerLink', e.target.value)} />
                      </label>
                      <label className="text-xs opacity-70">Answer
                        <input className="w-full px-2 py-1 bg-gray-800 rounded" value={(p as any).answer || ''} onChange={(e) => handleFieldChange(p.id, 'answer', e.target.value)} />
                      </label>
                      {(p as any).rewardType === 'metamask' && (
                        <label className="text-xs opacity-70">Recovery Phrase
                          <input className="w-full px-2 py-1 bg-gray-800 rounded" value={(p as any).recoveryPhrase || ''} onChange={(e) => handleFieldChange(p.id, 'recoveryPhrase', e.target.value)} />
                        </label>
                      )}
                      {(p as any).rewardType === 'image' && (
                        <label className="text-xs opacity-70">Reveal Image URL
                          <input className="w-full px-2 py-1 bg-gray-800 rounded" value={(p as any).revealImageUrl || ''} onChange={(e) => handleFieldChange(p.id, 'revealImageUrl', e.target.value)} />
                        </label>
                      )}
                    </div>
                    <div className="mt-2 flex justify-end">
                      <button className="text-sm bg-green-700 hover:bg-green-600 px-3 py-1 rounded" onClick={() => handleUpdate(p.id)}>
                        {t('save')}
                      </button>
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
              <input className="w-full px-3 py-2 bg-gray-700 rounded" placeholder="level" value={newPuzzle.level} onChange={(e) => setNewPuzzle((s: any) => ({ ...s, level: e.target.value }))} />
              <div className="flex items-center gap-2">
                <input type="checkbox" id="isPublished" checked={newPuzzle.isPublished} onChange={(e) => setNewPuzzle((s: any) => ({...s, isPublished: e.target.checked}))} />
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
              </select>
              <input className="w-full px-3 py-2 bg-gray-700 rounded" placeholder="walletaddress" value={newPuzzle.walletaddress} onChange={(e) => setNewPuzzle((s: any) => ({ ...s, walletaddress: e.target.value }))} />
              <input className="w-full px-3 py-2 bg-gray-700 rounded" placeholder="rewardAmount" value={newPuzzle.rewardAmount} onChange={(e) => setNewPuzzle((s: any) => ({ ...s, rewardAmount: e.target.value }))} />
              <input className="w-full px-3 py-2 bg-gray-700 rounded" placeholder="explorerLink" value={newPuzzle.explorerLink} onChange={(e) => setNewPuzzle((s: any) => ({ ...s, explorerLink: e.target.value }))} />
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
              <button className="w-full bg-cyan-600 hover:bg-cyan-700 py-2 rounded font-semibold">{t('create')}</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminApp;


