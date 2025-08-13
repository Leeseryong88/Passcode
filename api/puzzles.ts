import type { PublicPuzzle } from '../types';
import {
  getPuzzlesCallable,
  checkAnswerCallable,
  getAllPuzzlesAdminCallable,
  createPuzzleAdminCallable,
  updatePuzzleAdminCallable,
  deletePuzzleAdminCallable,
  setPuzzleSolvedAdminCallable,
  grantAdminRoleCallable,
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
    console.error("Error calling checkAnswer function:", error);
    // The Firebase Functions SDK provides a detailed error object.
    // The `message` property is suitable for user display.
    throw new Error(error.message || 'An error occurred while checking the answer.');
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
