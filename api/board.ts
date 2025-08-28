import { app, getBoardPostsCallable, addBoardPostCallable, uploadBoardImageCallable, getBoardPostsAdminCallable, updateBoardPostAdminCallable, deleteBoardPostAdminCallable, verifyBoardPostPasswordCallable } from '../firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';

export async function fetchBoardPosts(limit = 30, category?: string, startAfter?: number) {
  const res: any = await (getBoardPostsCallable as any)({ limit, category, startAfter });
  return res?.data ?? res;
}

export async function fetchBoardPost(id: string) {
  const res: any = await (getBoardPostsCallable as any)({ id });
  const data = res?.data ?? res;
  // Ensure fields exist for client rendering
  if (data) {
    const createdAt = (data as any).createdAt;
    const createdAtMillis = typeof (data as any).createdAtMillis === 'number' ? (data as any).createdAtMillis : (createdAt?.toMillis?.() ?? createdAt?.toDate?.()?.getTime?.());
    const commentCount = typeof (data as any).commentCount === 'number' ? (data as any).commentCount : (((data as any).comments?.length) || 0);
    return { ...data, createdAtMillis, commentCount };
  }
  return data;
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

export async function verifyBoardPostPassword(payload: { id: string; password: string }) {
  const res: any = await (verifyBoardPostPasswordCallable as any)(payload);
  return res?.data ?? res;
}

// Admin-only board APIs
export async function adminFetchBoardPosts(limit = 50, category?: string) {
  const res: any = await (getBoardPostsAdminCallable as any)({ limit, category });
  return res?.data ?? res;
}

export async function adminUpdateBoardPost(payload: { id: string; title?: string; content?: string; category?: string; imageUrls?: string[]; isPinned?: boolean; }) {
  const res: any = await (updateBoardPostAdminCallable as any)(payload);
  return res?.data ?? res;
}

export async function adminDeleteBoardPost(id: string) {
  const res: any = await (deleteBoardPostAdminCallable as any)({ id });
  return res?.data ?? res;
}


