import React, { useEffect, useMemo, useState } from 'react';
import Header from '../../components/Header';
import { fetchBoardPosts, createBoardPost, fetchBoardPost, addBoardComment, deleteBoardComment, deleteBoardPost, updateBoardPost, verifyBoardPostPassword } from '../../api/board';
import { Send, Trash2, Lock } from 'lucide-react';

type Post = {
  id: string;
  title: string;
  content?: string;
  comments?: { id: string; nickname: string; content: string }[];
  createdAt?: any;
  updatedAt?: any;
};

const PostListItem = React.memo(function PostListItem({ p, timeAgo, onOpen }: { p: any; timeAgo: (ts: any, ms?: number) => string; onOpen: (id: string) => void }) {
  return (
    <button onClick={() => onOpen(p.id)} className="w-full text-left p-4 bg-gray-800 border border-gray-700 rounded-xl hover:bg-gray-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-700 text-xs text-gray-300">{(p as any).category || '일반'}</span>
          <div className="text-lg font-bold">{p.title}</div>
        </div>
        <div className="text-xs text-gray-400">{timeAgo((p as any).createdAt, (p as any).createdAtMillis)} · 댓글 {Math.max(Number((p as any).commentCount || 0), Array.isArray((p as any).comments) ? (p as any).comments.length : 0)}개</div>
      </div>
    </button>
  );
});

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
  const [isEditPostOpen, setIsEditPostOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  // Password-first verification state
  const [isPwVerifyOpen, setIsPwVerifyOpen] = useState(false);
  const [pwInput, setPwInput] = useState('');
  const [pwError, setPwError] = useState('');
  const [verifiedPassword, setVerifiedPassword] = useState<string | null>(null);
  const [commentNickname, setCommentNickname] = useState('');
  const [commentPassword, setCommentPassword] = useState('');
  const [commentText, setCommentText] = useState('');
  const [search, setSearch] = useState('');
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
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

  const [fetchSize] = useState(20);
  const load = async (opts: { append?: boolean } = {}) => {
    const { append = false } = opts;
    if (append) setIsLoadingMore(true); else setIsLoading(true);
    try {
      const res = await fetchBoardPosts(fetchSize, category, append ? nextCursor ?? undefined : undefined);
      const list = (res.items ?? res) as any[];
      const normalizedList = list.map(normalizePost);
      setPosts((prev) => append ? [...prev, ...normalizedList] : normalizedList);
      setNextCursor(res.nextCursor ?? null);
      setError(null);
      // 댓글 카운트가 0으로 오는 아이템을 상세 조회로 보정 (최대 8개)
      const targets = normalizedList.filter((p: any) => Number(p?.commentCount || 0) === 0).slice(0, 8);
      targets.forEach(async (p: any) => {
        try {
          const detail = await fetchBoardPost(p.id);
          const fixed = normalizePost(detail);
          applyCommentCountToList(p.id, (fixed as any).commentCount ?? ((fixed as any).comments?.length || 0));
        } catch {}
      });
    } catch (e: any) {
      setError(e.message || 'Failed to load posts');
    } finally {
      if (append) setIsLoadingMore(false); else setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  // 카테고리 변경 시 자동 새로고침
  useEffect(() => { setNextCursor(null); setPosts([]); load(); }, [category]);

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

  const openEdit = () => {
    if (!activePost) return;
    setPwInput('');
    setPwError('');
    setIsPwVerifyOpen(true);
  };

  const confirmPasswordAndOpenEdit = async () => {
    if (!activePost) return;
    const pw = pwInput.trim();
    if (!pw) {
      setPwError('비밀번호를 입력해 주세요');
      return;
    }
    setPwError('');
    try {
      await verifyBoardPostPassword({ id: activePost.id, password: pw });
      setVerifiedPassword(pw);
      setEditTitle(activePost.title || '');
      setEditContent((activePost as any).content || '');
      setIsPwVerifyOpen(false);
      setIsEditPostOpen(true);
    } catch (e: any) {
      setPwError(e.message || '비밀번호가 올바르지 않습니다');
    }
  };

  const submitEdit = async () => {
    if (!activePost) return;
    try {
      await updateBoardPost({ id: activePost.id, password: String(verifiedPassword || ''), title: editTitle, content: editContent });
      const refreshed = await fetchBoardPost(activePost.id);
      const normalized = normalizePost(refreshed);
      setActivePost(normalized);
      // 목록에도 제목이 반영되도록 동기화
      setPosts((prev) => prev.map((p) => p.id === normalized.id ? ({ ...p, title: normalized.title, content: (normalized as any).content }) as any : p));
      setIsEditPostOpen(false);
    } catch (e: any) {
      alert(e.message || '수정 실패');
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
          <select value={category} onChange={(e) => { setCategory(e.target.value as any); }} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm">
            <option>일반</option>
            <option>퍼즐</option>
          </select>
          <button onClick={() => { setNextCursor(null); load(); }} className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm">필터 적용</button>
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
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse p-4 bg-gray-800/60 border border-gray-700/60 rounded-xl">
                <div className="h-5 w-1/3 bg-gray-700 rounded" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center text-red-400">{error}</div>
        ) : (
          activePost ? (
            <>
            <div className="p-4 bg-gray-800 border border-gray-700 rounded-xl">
              <div className="flex items-center justify-between">
                {isEditPostOpen ? (
                  <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="제목" className="flex-1 mr-3 px-3 py-2 bg-gray-700 border border-gray-600 rounded" />
                ) : (
                  <h3 className="text-xl font-bold">{activePost.title}</h3>
                )}
                <div className="flex items-center gap-2">
                  {!isEditPostOpen && !isPwVerifyOpen && (
                    <button onClick={openEdit} className="px-2 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded">수정</button>
                  )}
                  <button onClick={() => onDelete(activePost.id)} className="text-red-300 hover:text-red-200 px-2 py-1 rounded"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="mt-1 text-xs text-gray-400">{timeAgo((activePost as any).createdAt, (activePost as any).createdAtMillis)} · 댓글 {(activePost as any).commentCount ?? ((activePost as any).comments?.length || 0)}개</div>
              {isPwVerifyOpen && (
                <div className="mt-3 p-3 bg-gray-900 rounded-lg border border-gray-700">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-gray-300" />
                    <input
                      type="password"
                      value={pwInput}
                      onChange={(e) => setPwInput(e.target.value)}
                      placeholder="비밀번호"
                      className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded"
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmPasswordAndOpenEdit(); } }}
                      autoFocus
                    />
                    <button onClick={confirmPasswordAndOpenEdit} className="px-3 py-2 rounded bg-cyan-600 hover:bg-cyan-700 text-white">확인</button>
                    <button onClick={() => setIsPwVerifyOpen(false)} className="px-3 py-2 rounded border border-gray-600 text-gray-200 hover:bg-gray-700">취소</button>
                  </div>
                  {pwError && <div className="mt-2 text-sm text-red-400">{pwError}</div>}
                </div>
              )}
              {isEditPostOpen ? (
                <div className="mt-3 space-y-3">
                  <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} placeholder="내용" rows={8} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded" />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setIsEditPostOpen(false)} className="px-4 py-2 rounded border border-gray-600 text-gray-200 hover:bg-gray-700">취소</button>
                    <button onClick={submitEdit} disabled={!editTitle || !editContent || !verifiedPassword} className="px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-700 text-white disabled:bg-gray-600">저장</button>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-gray-200 whitespace-pre-wrap">{activePost.content}</p>
              )}
              <div className="mt-6 p-3 bg-gray-900 rounded-lg border border-gray-700">
                <h4 className="font-semibold mb-3">댓글 {(activePost as any).commentCount ?? ((activePost as any).comments?.length || 0)}</h4>
                <div className="space-y-2 mb-4">
                  {(activePost.comments || []).map((c) => (
                    <div key={c.id} className="p-2 bg-gray-800 border border-gray-700 rounded flex justify-between">
                      <div>
                        <div className="text-sm text-cyan-300 flex items-center gap-2">
                          <span>{c.nickname}</span>
                          {(c as any).ipMasked && <span className="text-xs text-gray-400">({(c as any).ipMasked})</span>}
                        </div>
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
            {/* 인라인 편집/검증으로 전환됨 */}
            </>
          ) : (
            <div className="space-y-2">
              {filtered.length === 0 ? (
                <div className="p-6 text-center text-gray-300 bg-gray-800/60 border border-gray-700/60 rounded-xl">
                  게시글이 없습니다. 첫 글을 작성해보세요.
                </div>
              ) : (
                filtered.map((p) => (
                  <PostListItem key={p.id} p={p as any} timeAgo={timeAgo} onOpen={openPost} />
                ))
              )}
              {/* 검색(좌) · 더 보기(중앙) · 글쓰기(우) */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                {/* Left: search */}
                <div className="order-1 sm:order-1">
                  <input value={search} onChange={(e) => { setSearch(e.target.value); }} placeholder="제목+내용 검색" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded" />
                  {search.trim() && (
                    <div className="mt-1 text-xs text-gray-400">검색 결과 {filtered.length}개</div>
                  )}
                </div>
                {/* Center: load more */}
                <div className="order-3 sm:order-2 flex justify-center">
                  {search.trim() ? (
                    <div className="text-sm text-gray-400">검색 중에는 더 보기를 사용할 수 없습니다</div>
                  ) : isLoadingMore ? (
                    <div className="text-sm text-gray-300">로딩 중…</div>
                  ) : nextCursor ? (
                    <button onClick={() => load({ append: true })} className="px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded text-white hover:bg-gray-700">더 보기</button>
                  ) : (
                    <div className="text-sm text-gray-400">더 이상 글이 없습니다</div>
                  )}
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


