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
  const [category, setCategory] = useState<'일반'|'퍼즐'>('일반');
  // const [nextCursor, setNextCursor] = useState<number | null>(null); // cursor 기반 페이징 미사용
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activePost, setActivePost] = useState<Post | null>(null);
  const [commentNickname, setCommentNickname] = useState('');
  const [commentPassword, setCommentPassword] = useState('');
  const [commentText, setCommentText] = useState('');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const getMillis = (ts: any, ms?: number): number | null => {
    if (typeof ms === 'number' && !Number.isNaN(ms)) return ms;
    if (!ts) return null;
    try {
      if (typeof ts === 'number') return ts;
      if (typeof ts?.toMillis === 'function') return ts.toMillis();
      if (typeof ts?.toDate === 'function') return ts.toDate().getTime();
      if (typeof ts?.seconds === 'number') return ts.seconds * 1000;
      if (typeof ts?._seconds === 'number') return ts._seconds * 1000;
    } catch {}
    return null;
  };
  const normalizePost = (p: any) => {
    const createdAtMillis = getMillis(p?.createdAt, p?.createdAtMillis) ?? null;
    const derivedLen = Array.isArray(p?.comments) ? p.comments.length : 0;
    const counted = typeof p?.commentCount === 'number' ? p.commentCount : 0;
    const commentCount = Math.max(counted, derivedLen);
    const category = p?.category || '일반';
    return { ...p, createdAtMillis, commentCount, category } as any;
  };
  const applyCommentCountToList = (postId: string, nextCount: number) => {
    setPosts((prev) => prev.map((it) => (it.id === postId ? ({ ...it, commentCount: nextCount }) as any : it)));
  };
  const timeAgo = (ts: any, ms?: number) => {
    const m = getMillis(ts, ms);
    if (m == null) return '';
    const diff = Date.now() - m;
    const sec = Math.max(1, Math.floor(diff / 1000));
    if (sec < 60) return `${sec}초 전`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}분 전`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}시간 전`;
    const day = Math.floor(hr / 24);
    if (day < 7) return `${day}일 전`;
    const d = new Date(m);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  };

  const [fetchSize] = useState(200);
  const load = async () => {
    setIsLoading(true);
    try {
      const res = await fetchBoardPosts(fetchSize, category);
      const list = (res.items ?? res) as any[];
      setPosts(list.map(normalizePost));
      // setNextCursor(res.nextCursor ?? null);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Failed to load posts');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // image upload removed

  // image upload removed

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

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return posts;
    return posts.filter((p) => `${p.title} ${(p.content||'')}`.toLowerCase().includes(q));
  }, [posts, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pagedPosts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const syncFromLocation = async () => {
    const params = new URLSearchParams(window.location.search);
    const pid = params.get('id');
    if (pid) {
      try {
        const p = await fetchBoardPost(pid);
        setActivePost(normalizePost(p));
        setIsComposerOpen(false);
      } catch {}
    } else {
      setActivePost(null);
    }
  };

  const openPost = async (id: string) => {
    try {
      window.history.pushState({ boardId: id }, '', `/board?id=${encodeURIComponent(id)}`);
      const p = await fetchBoardPost(id);
      setActivePost(normalizePost(p));
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
      const normalized = normalizePost(refreshed);
      setActivePost(normalized);
      applyCommentCountToList(normalized.id, (normalized as any).commentCount ?? ((normalized as any).comments?.length || 0));
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
      const normalized = normalizePost(refreshed);
      setActivePost(normalized);
      applyCommentCountToList(normalized.id, (normalized as any).commentCount ?? ((normalized as any).comments?.length || 0));
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

  useEffect(() => {
    syncFromLocation();
    const onPop = () => { syncFromLocation(); };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <Header />
      <main className="container mx-auto px-4 py-10">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">게시판</h1>
        </div>
        <div className="mb-4 flex items-center justify-end gap-2">
          <label className="text-sm text-gray-300">분류</label>
          <select value={category} onChange={(e) => { setCategory(e.target.value as any); setCurrentPage(1); }} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm">
            <option>일반</option>
            <option>퍼즐</option>
          </select>
          <button onClick={() => { setCurrentPage(1); load(); }} className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm">필터 적용</button>
        </div>
        {isComposerOpen && (
        <form onSubmit={onSubmit} className="mb-10 p-4 bg-gray-800 border border-gray-700 rounded-xl space-y-3">
          <div>
            <label className="mr-2 text-sm text-gray-300">분류</label>
            <select value={category} onChange={(e) => setCategory(e.target.value as any)} className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm">
              <option>일반</option>
              <option>퍼즐</option>
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
              <div className="mt-1 text-xs text-gray-400">{timeAgo((activePost as any).createdAt, (activePost as any).createdAtMillis)} · 댓글 {(activePost as any).commentCount ?? ((activePost as any).comments?.length || 0)}개</div>
              <p className="mt-2 text-gray-200 whitespace-pre-wrap">{activePost.content}</p>
              <div className="mt-6 p-3 bg-gray-900 rounded-lg border border-gray-700">
                <h4 className="font-semibold mb-3">댓글 {(activePost as any).commentCount ?? ((activePost as any).comments?.length || 0)}</h4>
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
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <input
                      value={commentNickname}
                      onChange={(e) => setCommentNickname(e.target.value)}
                      placeholder="닉네임"
                      className="px-3 py-2 bg-gray-700 border border-gray-600 rounded w-full sm:w-32"
                    />
                    <input
                      type="password"
                      value={commentPassword}
                      onChange={(e) => setCommentPassword(e.target.value)}
                      placeholder="비밀번호"
                      className="px-3 py-2 bg-gray-700 border border-gray-600 rounded w-full sm:w-40"
                    />
                    <input
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="내용"
                      className="px-3 py-2 bg-gray-700 border border-gray-600 rounded flex-1 w-full"
                    />
                    <button
                      onClick={submitComment}
                      className="bg-cyan-600 hover:bg-cyan-700 text-white font-semibold px-4 py-2 rounded w-full sm:w-auto"
                    >
                      등록
                    </button>
                  </div>
                </div>
              </div>
              <div className="mt-6">
                <button onClick={() => { window.history.pushState({}, '', '/board'); setActivePost(null); }} className="text-sm text-gray-300 underline">목록으로</button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {pagedPosts.map((p) => (
                <button key={p.id} onClick={() => openPost(p.id)} className="w-full text-left p-4 bg-gray-800 border border-gray-700 rounded-xl hover:bg-gray-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-700 text-xs text-gray-300">{(p as any).category || '일반'}</span>
                      <div className="text-lg font-bold">{p.title}</div>
                    </div>
                    <div className="text-xs text-gray-400">{timeAgo((p as any).createdAt, (p as any).createdAtMillis)} · 댓글 {Math.max(Number((p as any).commentCount || 0), Array.isArray((p as any).comments) ? (p as any).comments.length : 0)}개</div>
                  </div>
                </button>
              ))}
              {/* 검색(좌) · 페이지네이션(중앙) · 글쓰기(우) */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                {/* Left: search */}
                <div className="order-1 sm:order-1">
                  <input value={search} onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }} placeholder="제목+내용 검색" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded" />
                </div>
                {/* Center: pagination */}
                <div className="order-3 sm:order-2 flex justify-center">
                  <div className="flex items-center gap-1 flex-wrap justify-center">
                    <button disabled={currentPage<=1} onClick={() => setCurrentPage((p)=>Math.max(1,p-1))} className="px-2 py-1 text-sm bg-gray-800 border border-gray-700 rounded text-white disabled:opacity-40">이전</button>
                    {Array.from({ length: pageCount }).slice(0, 20).map((_, i) => {
                      const n = i + 1;
                      return (
                        <button key={n} onClick={() => setCurrentPage(n)} className={`px-2 py-1 text-sm rounded border ${currentPage===n? 'bg-cyan-600 border-cyan-500 text-white':'bg-gray-800 border-gray-700 text-gray-200'}`}>{n}</button>
                      );
                    })}
                    <button disabled={currentPage>=pageCount} onClick={() => setCurrentPage((p)=>Math.min(pageCount,p+1))} className="px-2 py-1 text-sm bg-gray-800 border border-gray-700 rounded text-white disabled:opacity-40">다음</button>
                  </div>
                </div>
                {/* Right: write button */}
                <div className="order-2 sm:order-3 flex justify-end">
                  <a href="/board/new" className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold rounded-lg">글쓰기</a>
                </div>
              </div>
            </div>
          )
        )}
      </main>
    </div>
  );
};

export default Board;


