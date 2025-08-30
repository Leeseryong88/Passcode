import type { PublicPuzzle } from '../types';
import {
  getPuzzlesCallable,
  checkAnswerCallable,
  getSolvedAnswerCallable,
  getAllPuzzlesAdminCallable,
  createPuzzleAdminCallable,
  updatePuzzleAdminCallable,
  deletePuzzleAdminCallable,
  setPuzzleSolvedAdminCallable,
  getAdsCallable,
  getAllAdsAdminCallable,
  createAdAdminCallable,
  updateAdAdminCallable,
  deleteAdAdminCallable,
  // batch
  // We'll reference these via httpsCallable using functions names at runtime if not exported here
} from '../firebase';
import { auth } from '../firebase';

/**
 * Fetches public puzzle data from the live Firebase Cloud Function using a callable function.
 */
export const getPublicPuzzles = async (): Promise<PublicPuzzle[]> => {
  try {
    const result = await getPuzzlesCallable();
    // The callable function returns an object with a 'data' property.
    return result.data as PublicPuzzle[];
  } catch (error) {
    console.error("Error calling getPuzzles function:", error);
    // Re-throw a user-friendly error.
    throw new Error('Failed to fetch puzzles from the server.');
  }
};

/**
 * Calls the secure Firebase Cloud Function to check the user's answer using a callable function.
 * @param puzzleId The ID of the puzzle being solved.
 * @param guess The user's submitted answer.
 * @returns A promise that resolves with the recovery phrase if the answer is correct.
 * @throws An error if the answer is incorrect or any other server error occurs.
 */
export const checkPuzzleAnswer = async (
  puzzleId: number,
  guess: string
): Promise<
  | { type: 'metamask'; recoveryPhrase: string }
  | { type: 'image'; revealImageUrl: string }
  | { type: 'text'; revealText: string }
  | { type: 'already_solved' }
  | { type: 'wrong' }
> => {
   try {
    const result = await checkAnswerCallable({ puzzleId, guess });
    const data = result.data as any;
    // 서버가 오답을 200으로 반환하는 경우, 클라이언트에서는 예외로 변환해 동일한 UX 유지
    if (data && data.type === 'wrong') {
      const err: any = new Error('Incorrect answer. Please try again.');
      // 표준 SDK 에러가 아니므로, 우리 쪽에서 식별 가능한 플래그를 추가해 콘솔 노이즈 억제
      err.expectedWrongAnswer = true;
      throw err;
    }
    return data;
  } catch (error: any) {
    const code = error?.code as string | undefined;
    const isExpectedWrongAnswer =
      code === 'functions/failed-precondition' ||
      code === 'functions/unauthenticated' ||
      Boolean((error as any)?.expectedWrongAnswer);
    if (!isExpectedWrongAnswer) {
      console.error("Error calling checkAnswer function:", error);
    }
    // The Firebase Functions SDK provides a detailed error object.
    // The `message` property is suitable for user display.
    throw new Error(error.message || 'An error occurred while checking the answer.');
  }
};

export const getSolvedAnswer = async (puzzleId: number): Promise<string | null> => {
  try {
    const result = await getSolvedAnswerCallable({ puzzleId });
    return (result.data as any)?.answer ?? null;
  } catch {
    return null;
  }
};

export const submitSolverName = async (puzzleId: number, name: string): Promise<{ success: boolean }> => {
  try {
    const { getFunctions, httpsCallable } = await import('firebase/functions');
    const functions = getFunctions(undefined as any, 'us-central1');
    const callable = httpsCallable(functions as any, 'setSolverName');
    const res: any = await callable({ puzzleId, name });
    return (res.data as any) || { success: true };
  } catch (error: any) {
    throw new Error(error?.message || 'Failed to submit solver name');
  }
};

// Admin APIs
export const getAllPuzzlesAdmin = async (): Promise<any[]> => {
  const result = await getAllPuzzlesAdminCallable();
  return result.data as any[];
};

export const createPuzzleAdmin = async (payload: any): Promise<{ success: boolean; docId: string }> => {
  const result = await createPuzzleAdminCallable(payload);
  return result.data as { success: boolean; docId: string };
};

export const updatePuzzleAdmin = async (payload: any): Promise<{ success: boolean; updated: boolean }> => {
  const result = await updatePuzzleAdminCallable(payload);
  return result.data as { success: boolean; updated: boolean };
};

export const deletePuzzleAdmin = async (id: number): Promise<{ success: boolean }> => {
  const result = await deletePuzzleAdminCallable({ id });
  return result.data as { success: boolean };
};

export const setPuzzleSolvedAdmin = async (id: number, isSolved: boolean): Promise<{ success: boolean }> => {
  const result = await setPuzzleSolvedAdminCallable({ id, isSolved });
  return result.data as { success: boolean };
};

// grantAdminRole removed per product decision

// Batch Admin APIs (callable by name to avoid import churn)
export const updatePuzzlesBatchAdmin = async (updates: any[]): Promise<{ success: boolean }> => {
  const { getFunctions, httpsCallable } = await import('firebase/functions'); // eslint-disable-line @typescript-eslint/no-var-requires
  const functions = getFunctions(undefined as any, 'us-central1');
  const callable = httpsCallable(functions as any, 'updatePuzzlesBatchAdmin');
  const result: any = await callable({ updates });
  return result.data as { success: boolean };
};

// Ads APIs
export type PublicAd = { id: number; shortUrl: string; imageUrl?: string; isActive: boolean };

export const getPublicAds = async (): Promise<PublicAd[]> => {
  const res = await getAdsCallable();
  return (res.data as any[]) as PublicAd[];
};

export const getAllAdsAdmin = async (): Promise<any[]> => {
  try { await auth.currentUser?.getIdToken(true); } catch {}
  const res = await getAllAdsAdminCallable();
  return (res.data as any)?.items ?? (res.data as any);
};

export const createAdAdmin = async (payload: { id: number; shortUrl: string; isActive?: boolean }): Promise<{ success: boolean; docId: string }> => {
  try { await auth.currentUser?.getIdToken(true); } catch {}
  const res = await createAdAdminCallable(payload);
  return res.data as any;
};

export const updateAdAdmin = async (payload: { id: number; shortUrl?: string; imageUrl?: string; isActive?: boolean }): Promise<{ success: boolean }> => {
  try { await auth.currentUser?.getIdToken(true); } catch {}
  const res = await updateAdAdminCallable(payload);
  return res.data as any;
};

export const deleteAdAdmin = async (id: number): Promise<{ success: boolean }> => {
  try { await auth.currentUser?.getIdToken(true); } catch {}
  const res = await deleteAdAdminCallable({ id });
  return res.data as any;
};

export const deletePuzzlesBatchAdmin = async (ids: number[]): Promise<{ success: boolean }> => {
  const { getFunctions, httpsCallable } = await import('firebase/functions'); // eslint-disable-line @typescript-eslint/no-var-requires
  const functions = getFunctions(undefined as any, 'us-central1');
  const callable = httpsCallable(functions as any, 'deletePuzzlesBatchAdmin');
  const result: any = await callable({ ids });
  return result.data as { success: boolean };
};
