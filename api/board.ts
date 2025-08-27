import { app, getBoardPostsCallable, addBoardPostCallable, uploadBoardImageCallable } from '../firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';

export async function fetchBoardPosts(limit = 30) {
  const res: any = await (getBoardPostsCallable as any)({ limit });
  return res?.data ?? res;
}

export async function fetchBoardPost(id: string) {
  const res: any = await (getBoardPostsCallable as any)({ id });
  return res?.data ?? res;
}

export async function createBoardPost(payload: { title: string; content: string; password: string; imageUrls?: string[] }) {
  const res: any = await (addBoardPostCallable as any)(payload);
  return res?.data ?? res;
}

export async function uploadBoardImage(base64: string, contentType: string) {
  const res: any = await (uploadBoardImageCallable as any)({ base64, contentType });
  return res?.data ?? res;
}

export async function updateBoardPost(payload: { id: string; password: string; title?: string; content?: string; imageUrls?: string[] }) {
  const functions = getFunctions(app, 'us-central1');
  const callable = httpsCallable(functions, 'updateBoardPost');
  const res: any = await callable(payload);
  return res?.data ?? res;
}

export async function deleteBoardPost(payload: { id: string; password: string }) {
  const functions = getFunctions(app, 'us-central1');
  const callable = httpsCallable(functions, 'deleteBoardPost');
  const res: any = await callable(payload);
  return res?.data ?? res;
}


