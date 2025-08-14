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
  grantAdminRoleCallable,
  // batch
  // We'll reference these via httpsCallable using functions names at runtime if not exported here
} from '../firebase';

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
export const checkPuzzleAnswer = async (puzzleId: number, guess: string): Promise<{ type: 'metamask'; recoveryPhrase: string } | { type: 'image'; revealImageUrl: string }> => {
   try {
    const result = await checkAnswerCallable({ puzzleId, guess });
    return result.data as any;
  } catch (error: any) {
    const code = error?.code as string | undefined;
    const isExpectedWrongAnswer = code === 'functions/failed-precondition' || code === 'functions/unauthenticated';
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

export const grantAdminRole = async (email: string, secret: string): Promise<{ success: boolean; uid: string }> => {
  const result = await grantAdminRoleCallable({ email, secret });
  return result.data as { success: boolean; uid: string };
};

// Batch Admin APIs (callable by name to avoid import churn)
export const updatePuzzlesBatchAdmin = async (updates: any[]): Promise<{ success: boolean }> => {
  const { getFunctions, httpsCallable } = await import('firebase/functions'); // eslint-disable-line @typescript-eslint/no-var-requires
  const functions = getFunctions(undefined as any, 'us-central1');
  const callable = httpsCallable(functions as any, 'updatePuzzlesBatchAdmin');
  const result: any = await callable({ updates });
  return result.data as { success: boolean };
};

export const deletePuzzlesBatchAdmin = async (ids: number[]): Promise<{ success: boolean }> => {
  const { getFunctions, httpsCallable } = await import('firebase/functions'); // eslint-disable-line @typescript-eslint/no-var-requires
  const functions = getFunctions(undefined as any, 'us-central1');
  const callable = httpsCallable(functions as any, 'deletePuzzlesBatchAdmin');
  const result: any = await callable({ ids });
  return result.data as { success: boolean };
};
