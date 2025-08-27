import React, { useState } from 'react';
import Header from '../../components/Header';
import { createBoardPost } from '../../api/board';
import { Lock, Send, ArrowLeft } from 'lucide-react';

const BoardNew: React.FC = () => {
  const [category, setCategory] = useState<'일반'|'퍼즐'>('일반');
  const [title, setTitle] = useState('');
  const [password, setPassword] = useState('');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPwModalOpen, setIsPwModalOpen] = useState(false);
  const [pwInput, setPwInput] = useState('');
  const [pwError, setPwError] = useState('');

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    // 비밀번호가 비어 있으면 모달 오픈
    if (!password.trim()) {
      setPwInput('');
      setPwError('');
      setIsPwModalOpen(true);
      return;
    }
    setIsSubmitting(true);
    try {
      await createBoardPost({ title, content, password, category });
      window.location.href = '/board';
    } catch (e: any) {
      alert(e.message || '등록 실패');
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmPasswordAndSave = async () => {
    if (isSubmitting) return;
    const pw = pwInput.trim();
    if (!pw) {
      setPwError('비밀번호를 입력해 주세요');
      return;
    }
    setPwError('');
    setPassword(pw);
    setIsSubmitting(true);
    try {
      await createBoardPost({ title, content, password: pw, category });
      setIsPwModalOpen(false);
      window.location.href = '/board';
    } catch (e: any) {
      alert(e.message || '등록 실패');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <Header />
      <main className="container mx-auto px-4 py-10">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">새 글쓰기</h1>
          <a href="/board" className="inline-flex items-center gap-2 text-gray-300 hover:text-white"><ArrowLeft className="w-4 h-4" /> 목록으로</a>
        </div>
        <form onSubmit={onSubmit} className="p-4 bg-gray-800 border border-gray-700 rounded-xl space-y-4">
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-300">분류</label>
            <select value={category} onChange={(e) => setCategory(e.target.value as any)} className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm">
              <option>일반</option>
              <option>퍼즐</option>
            </select>
          </div>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="제목" className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded" />
          <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="내용" rows={10} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded" />
          <div className="flex justify-end">
            <button disabled={isSubmitting || !title || !content} className="inline-flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold px-5 py-2 rounded disabled:bg-gray-600">
              <Send className="w-4 h-4" /> 등록
            </button>
          </div>
        </form>

        {isPwModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60" onClick={() => setIsPwModalOpen(false)} />
            <div className="relative z-10 w-full max-w-sm mx-4 p-5 bg-gray-800 border border-gray-700 rounded-xl shadow-xl">
              <div className="flex items-center gap-2 mb-3">
                <Lock className="w-4 h-4 text-gray-300" />
                <h3 className="text-lg font-semibold">비밀번호 입력</h3>
              </div>
              <p className="text-sm text-gray-300 mb-3">수정/삭제를 위해 비밀번호가 필요합니다.</p>
              <input
                type="password"
                value={pwInput}
                onChange={(e) => setPwInput(e.target.value)}
                placeholder="비밀번호"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmPasswordAndSave(); } }}
                autoFocus
              />
              {pwError && <div className="mt-2 text-sm text-red-400">{pwError}</div>}
              <div className="mt-4 flex justify-end gap-2">
                <button onClick={() => setIsPwModalOpen(false)} className="px-4 py-2 rounded border border-gray-600 text-gray-200 hover:bg-gray-700">취소</button>
                <button onClick={confirmPasswordAndSave} disabled={isSubmitting} className="px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-700 text-white disabled:bg-gray-600">확인</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default BoardNew;


