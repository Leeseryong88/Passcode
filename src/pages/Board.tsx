import React, { useEffect, useMemo, useState } from 'react';
import Header from '../../components/Header';
import { fetchBoardPosts, createBoardPost, uploadBoardImage, updateBoardPost, deleteBoardPost } from '../../api/board';
import { Image as ImageIcon, Send, Trash2, Edit3, Lock } from 'lucide-react';

type Post = {
  id: string;
  title: string;
  content: string;
  imageUrls?: string[];
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
  const [images, setImages] = useState<File[]>([]);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = async () => {
    setIsLoading(true);
    try {
      const list = await fetchBoardPosts(50);
      setPosts(list);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Failed to load posts');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleImages = (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files).slice(0, 6);
    setImages(arr);
  };

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
      const uploaded: string[] = [];
      for (const f of images) {
        const b64 = await toBase64(f);
        const res = await uploadBoardImage(b64, f.type || 'image/png');
        if (res?.url) uploaded.push(res.url);
      }
      await createBoardPost({ title, content, password, imageUrls: uploaded });
      setTitle(''); setContent(''); setPassword(''); setImages([]);
      await load();
    } catch (e: any) {
      alert(e.message || 'Failed to submit');
    } finally {
      setIsSubmitting(false);
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
          <button onClick={() => setIsComposerOpen((v) => !v)} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-lg text-white font-semibold">
            {isComposerOpen ? '닫기' : '글쓰기'}
          </button>
        </div>
        {isComposerOpen && (
        <form onSubmit={onSubmit} className="mb-10 p-4 bg-gray-800 border border-gray-700 rounded-xl space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="제목" className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500" />
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-gray-300" />
              <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="비밀번호(수정/삭제용)" className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500" />
            </div>
          </div>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="내용" rows={4} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500" />
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg cursor-pointer">
              <ImageIcon className="w-4 h-4" /> 이미지 업로드
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleImages(e.target.files)} />
            </label>
            <span className="text-xs text-gray-400">최대 6장</span>
          </div>
          {images.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {images.map((f, i) => (
                <img key={i} src={URL.createObjectURL(f)} className="w-full h-20 object-cover rounded" />
              ))}
            </div>
          )}
          <button disabled={isSubmitting || !title || !content || !password} className="inline-flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold px-5 py-2 rounded-lg disabled:bg-gray-600">
            <Send className="w-4 h-4" /> 등록
          </button>
        </form>
        )}

        {isLoading ? (
          <div className="text-center text-gray-400">로딩 중…</div>
        ) : error ? (
          <div className="text-center text-red-400">{error}</div>
        ) : (
          <div className="space-y-4">
            {posts.map((p) => (
              <div key={p.id} className="p-4 bg-gray-800 border border-gray-700 rounded-xl">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold">{p.title}</h3>
                  <div className="flex items-center gap-2">
                    <button onClick={() => onDelete(p.id)} className="text-red-300 hover:text-red-200 px-2 py-1 rounded">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-gray-200 whitespace-pre-wrap">{p.content}</p>
                {p.imageUrls && p.imageUrls.length > 0 && (
                  <div className="mt-3 grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {p.imageUrls.map((u, i) => (
                      <img key={i} src={u} className="w-full h-24 object-cover rounded" />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Board;


