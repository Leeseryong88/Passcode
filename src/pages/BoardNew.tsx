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

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
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
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-gray-300" />
            <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="비밀번호(수정/삭제용)" className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded" />
          </div>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="내용" rows={10} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded" />
          <div className="flex justify-end">
            <button disabled={isSubmitting || !title || !content || !password} className="inline-flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold px-5 py-2 rounded disabled:bg-gray-600">
              <Send className="w-4 h-4" /> 등록
            </button>
          </div>
        </form>
      </main>
    </div>
  );
};

export default BoardNew;


