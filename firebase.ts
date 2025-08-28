import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, User, getIdTokenResult } from "firebase/auth";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAISyJPHENQQBoXHJRnn0vWZAo59Ka1Jyo",
  authDomain: "crypto-puzzle-e089f.firebaseapp.com",
  projectId: "crypto-puzzle-e089f",
  storageBucket: "crypto-puzzle-e089f.appspot.com",
  messagingSenderId: "290083299316",
  appId: "1:290083299316:web:36b3d0d95d1431b1d823a1",
  measurementId: "G-FMMD3ZBEBC"
};


// Initialize Firebase
export const app = initializeApp(firebaseConfig);
// 지연 초기화 대상: analytics, storage
export const auth = getAuth(app);
// App Check (optional; disabled by default since this project is not enforcing App Check)
if (typeof window !== 'undefined') {
  try {
    const enableAppCheck = (import.meta as any).env?.VITE_ENABLE_APPCHECK === '1';
    if (enableAppCheck) {
      const siteKey = (import.meta as any).env?.VITE_RECAPTCHA_V3_SITE_KEY as string | undefined;
      if ((import.meta as any).env?.DEV === true && !siteKey) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
      }
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(siteKey || 'debug'),
        isTokenAutoRefreshEnabled: true,
      });
    } else {
      console.info('App Check is disabled (set VITE_ENABLE_APPCHECK=1 to enable).');
    }
  } catch (err) {
    console.warn('AppCheck init skipped:', err);
  }
}

// Functions는 즉시 초기화하되, 다른 무거운 모듈은 지연
export const functionsInst = getFunctions(app, 'us-central1');
// Optional: explicitly route to regional endpoint (can help with some CORS/proxy setups)
(functionsInst as any).customDomain = 'https://us-central1-crypto-puzzle-e089f.cloudfunctions.net';

// Create callable function references. The name must match the deployed function name.
export const getPuzzlesCallable = httpsCallable(functionsInst, 'getPuzzles');
export const checkAnswerCallable = httpsCallable(functionsInst, 'checkAnswer');
export const getSolvedAnswerCallable = httpsCallable(functionsInst, 'getSolvedAnswer');
export const setSolverNameCallable = httpsCallable(functionsInst, 'setSolverName');

// Board callables
export const getBoardPostsCallable = httpsCallable(functionsInst, 'getBoardPosts');
export const addBoardPostCallable = httpsCallable(functionsInst, 'addBoardPost');
export const addCommentToPostCallable = httpsCallable(functionsInst, 'addCommentToPost');
export const uploadBoardImageCallable = httpsCallable(functionsInst, 'uploadBoardImage');
export const updateBoardPostCallable = httpsCallable(functionsInst, 'updateBoardPost');
export const deleteBoardPostCallable = httpsCallable(functionsInst, 'deleteBoardPost');
export const fixCommentCountsCallable = httpsCallable(functionsInst, 'fixCommentCounts');
export const verifyBoardPostPasswordCallable = httpsCallable(functionsInst, 'verifyBoardPostPassword');
// Admin board callables
export const getBoardPostsAdminCallable = httpsCallable(functionsInst, 'getBoardPostsAdmin');
export const updateBoardPostAdminCallable = httpsCallable(functionsInst, 'updateBoardPostAdmin');
export const deleteBoardPostAdminCallable = httpsCallable(functionsInst, 'deleteBoardPostAdmin');

// Admin callables
export const getAllPuzzlesAdminCallable = httpsCallable(functionsInst, 'getAllPuzzlesAdmin');
export const createPuzzleAdminCallable = httpsCallable(functionsInst, 'createPuzzleAdmin');
export const updatePuzzleAdminCallable = httpsCallable(functionsInst, 'updatePuzzleAdmin');
export const deletePuzzleAdminCallable = httpsCallable(functionsInst, 'deletePuzzleAdmin');
export const setPuzzleSolvedAdminCallable = httpsCallable(functionsInst, 'setPuzzleSolvedAdmin');
// grantAdminRole callable removed
export const uploadImageAdminCallable = httpsCallable(functionsInst, 'uploadImageAdmin');

// Auth helpers
export async function signInWithEmailPassword(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signOutCurrentUser() {
  return signOut(auth);
}

export function onAuthStateChangedListener(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export async function isCurrentUserAdmin(): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;
  const tokenResult = await getIdTokenResult(user, true);
  return Boolean((tokenResult.claims as any)?.admin);
}

// 선택적: Analytics 지연 초기화 유틸리티
export async function ensureAnalytics() {
  try {
    const { getAnalytics } = await import('firebase/analytics');
    return getAnalytics(app);
  } catch (err) {
    if ((import.meta as any).env?.DEV) console.info('Analytics init skipped', err);
    return null;
  }
}

// 선택적: Storage 지연 초기화 유틸리티 (Admin에서만 사용 권장)
export async function ensureStorage() {
  const { getStorage } = await import('firebase/storage');
  return getStorage(app);
}
