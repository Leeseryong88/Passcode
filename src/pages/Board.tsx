import React, { useEffect, useMemo, useState } from 'react';
import Header from '../../components/Header';
import { fetchBoardPosts, createBoardPost, fetchBoardPost, addBoardComment, deleteBoardComment, deleteBoardPost } from '../../api/board';
import { Send, Trash2, Lock } from 'lucide-react';

type Post = {
  id: string;
  title: string;
  content?: string;
  comments?: { id: string; nickname: string; content: string }[];
  createdAt?: any;
  updatedAt?: any;
};

const Board: React.FC = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [password, setPassword] = useState('');
  const [category, setCategory] = useState<'일반'|'공지'|'질문'>('일반');
  const [images, setImages] = useState<File[]>([]);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activePost, setActivePost] = useState<Post | null>(null);
  const [commentNickname, setCommentNickname] = useState('');
  const [commentPassword, setCommentPassword] = useState('');
  const [commentText, setCommentText] = useState('');
  const formatDate = (ts: any) => {
    try {
      if (!ts) return '';
      const d = (ts?.toDate ? ts.toDate() : new Date(ts.seconds ? ts.seconds * 1000 : ts)) as Date;
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch { return ''; }
  };

  const [pageSize] = useState(20);
  const load = async () => {
    setIsLoading(true);
    try {
      const list = await fetchBoardPosts(pageSize, category);
      setPosts(list);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Failed to load posts');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // image upload removed

  const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await createBoardPost({ title, content, password, category });
      setTitle(''); setContent(''); setPassword('');
      await load();
    } catch (e: any) {
      alert(e.message || 'Failed to submit');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openPost = async (id: string) => {
    try {
      const p = await fetchBoardPost(id);
      setActivePost(p);
      setIsComposerOpen(false);
    } catch (e: any) {
      alert(e.message || '불러오기 실패');
    }
  };

  const submitComment = async () => {
    if (!activePost) return;
    try {
      await addBoardComment({ id: activePost.id, nickname: commentNickname, content: commentText, password: commentPassword });
      const refreshed = await fetchBoardPost(activePost.id);
      setActivePost(refreshed);
      setCommentNickname(''); setCommentPassword(''); setCommentText('');
    } catch (e: any) {
      alert(e.message || '댓글 등록 실패');
    }
  };

  const removeComment = async (commentId: string) => {
    if (!activePost) return;
    const pw = prompt('댓글 비밀번호를 입력하세요');
    if (!pw) return;
    try {
      await deleteBoardComment({ id: activePost.id, commentId, password: pw });
      const refreshed = await fetchBoardPost(activePost.id);
      setActivePost(refreshed);
    } catch (e: any) {
      alert(e.message || '댓글 삭제 실패');
    }
  };

  const onDelete = async (id: string) => {
    const pw = prompt('비밀번호를 입력하세요');
    if (!pw) return;
    try {
      await deleteBoardPost({ id, password: pw });
      await load();
    } catch (e: any) {
      alert(e.message || '삭제 실패');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <Header />
      <main className="container mx-auto px-4 py-10">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">게시판</h1>
          <div className="flex items-center gap-2">
            <select value={category} onChange={(e) => { setCategory(e.target.value as any); }} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm">
              <option>일반</option>
              <option>공지</option>
              <option>질문</option>
            </select>
            <button onClick={load} className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm">필터 적용</button>
          </div>
          <button onClick={() => setIsComposerOpen((v) => !v)} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-lg text-white font-semibold">
            {isComposerOpen ? '닫기' : '글쓰기'}
          </button>
        </div>
        {isComposerOpen && (
        <form onSubmit={onSubmit} className="mb-10 p-4 bg-gray-800 border border-gray-700 rounded-xl space-y-3">
          <div>
            <label className="mr-2 text-sm text-gray-300">분류</label>
            <select value={category} onChange={(e) => setCategory(e.target.value as any)} className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm">
              <option>일반</option>
              <option>공지</option>
              <option>질문</option>
            </select>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="제목" className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500" />
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-gray-300" />
              <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="비밀번호(수정/삭제용)" className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500" />
            </div>
          </div>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="내용" rows={4} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500" />
          <button disabled={isSubmitting || !title || !content || !password} className="inline-flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold px-5 py-2 rounded-lg disabled:bg-gray-600">
            <Send className="w-4 h-4" /> 등록
          </button>
        </form>
        )}

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse p-4 bg-gray-800/60 border border-gray-700/60 rounded-xl">
                <div className="h-5 w-1/3 bg-gray-700 rounded" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center text-red-400">{error}</div>
        ) : (
          activePost ? (
            <div className="p-4 bg-gray-800 border border-gray-700 rounded-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">{activePost.title}</h3>
                <button onClick={() => onDelete(activePost.id)} className="text-red-300 hover:text-red-200 px-2 py-1 rounded"><Trash2 className="w-4 h-4" /></button>
              </div>
              <p className="mt-2 text-gray-200 whitespace-pre-wrap">{activePost.content}</p>
              <div className="mt-6 p-3 bg-gray-900 rounded-lg border border-gray-700">
                <h4 className="font-semibold mb-3">댓글</h4>
                <div className="space-y-2 mb-4">
                  {(activePost.comments || []).map((c) => (
                    <div key={c.id} className="p-2 bg-gray-800 border border-gray-700 rounded flex justify-between">
                      <div>
                        <div className="text-sm text-cyan-300">{c.nickname}</div>
                        <div className="text-gray-200 whitespace-pre-wrap">{c.content}</div>
                      </div>
                      <button onClick={() => removeComment(c.id)} className="text-red-300 hover:text-red-200">삭제</button>
                    </div>
                  ))}
                </div>
                <div className="border-t border-gray-700 pt-3">
                  <div className="grid sm:grid-cols-3 gap-2 mb-3">
                    <input value={commentNickname} onChange={(e) => setCommentNickname(e.target.value)} placeholder="닉네임" className="px-3 py-2 bg-gray-700 border border-gray-600 rounded" />
                    <input value={commentPassword} onChange={(e) => setCommentPassword(e.target.value)} placeholder="비밀번호" className="px-3 py-2 bg-gray-700 border border-gray-600 rounded" />
                    <button onClick={submitComment} className="bg-cyan-600 hover:bg-cyan-700 text-white font-semibold px-3 rounded">등록</button>
                  </div>
                  <textarea value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="내용" rows={3} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded" />
                </div>
              </div>
              <div className="mt-6">
                <button onClick={() => setActivePost(null)} className="text-sm text-gray-300 underline">목록으로</button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {posts.map((p) => (
                <button key={p.id} onClick={() => openPost(p.id)} className="w-full text-left p-4 bg-gray-800 border border-gray-700 rounded-xl hover:bg-gray-700">
                  <div className="flex items-center justify-between">
                    <div className="text-lg font-bold">{p.title}</div>
                    <div className="text-xs text-gray-400">{formatDate(p.createdAt)}</div>
                  </div>
                </button>
              ))}
            </div>
          )
        )}
      </main>
    </div>
  );
};

export default Board;


