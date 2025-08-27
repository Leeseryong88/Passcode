import { app, getBoardPostsCallable, addBoardPostCallable, uploadBoardImageCallable } from '../firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';

export async function fetchBoardPosts(limit = 30, category?: string, startAfter?: number) {
  const res: any = await (getBoardPostsCallable as any)({ limit, category, startAfter });
  return res?.data ?? res;
}

export async function fetchBoardPost(id: string) {
  const res: any = await (getBoardPostsCallable as any)({ id });
  return res?.data ?? res;
}

export async function createBoardPost(payload: { title: string; content: string; password: string; category?: string }) {
  const res: any = await (addBoardPostCallable as any)(payload);
  return res?.data ?? res;
}

// image upload removed

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

export async function addBoardComment(payload: { id: string; nickname: string; content: string; password: string }) {
  const functions = getFunctions(app, 'us-central1');
  const callable = httpsCallable(functions, 'addBoardComment');
  const res: any = await callable(payload);
  return res?.data ?? res;
}

export async function deleteBoardComment(payload: { id: string; commentId: string; password: string }) {
  const functions = getFunctions(app, 'us-central1');
  const callable = httpsCallable(functions, 'deleteBoardComment');
  const res: any = await callable(payload);
  return res?.data ?? res;
}


