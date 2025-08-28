/* eslint-disable max-len */
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { createHash, randomBytes } from "crypto";

// Initialize Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();

function getDefaultBucket() {
  const configured = (admin.app().options as any)?.storageBucket as string | undefined;
  const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
  const fallback = projectId ? `${projectId}.appspot.com` : undefined;
  return admin.storage().bucket(configured || fallback);
}

function extractStoragePath(value?: string | null): string | null {
  if (!value) return null;
  const v = String(value);
  // Match firebase public URL: .../o/<object>?...
  let m = v.match(/\/o\/([^?]+)/);
  if (m && m[1]) return decodeURIComponent(m[1]);
  // Match storage.googleapis.com/<bucket>/<object>
  m = v.match(/storage\.googleapis\.com\/(?:[^/]+)\/(.+)$/);
  if (m && m[1]) return decodeURIComponent(m[1]);
  // Match gs://<bucket>/<object>
  m = v.match(/^gs:\/\/[^/]+\/(.+)$/);
  if (m && m[1]) return decodeURIComponent(m[1]);
  // Direct path
  if (/^(puzzles|rewards)\//.test(v)) return v;
  return null;
}

function hashPassword(raw: string, salt?: string) {
  const s = salt || randomBytes(8).toString('hex');
  const h = createHash('sha256').update(`${s}:${String(raw)}`).digest('hex');
  return { salt: s, hash: h };
}

function extractClientIp(req: any): string | null {
  try {
    const xfwd = req?.headers?.['x-forwarded-for'];
    if (typeof xfwd === 'string' && xfwd.length > 0) {
      return xfwd.split(',')[0].trim();
    }
    const ip = (req?.ip || req?.connection?.remoteAddress || req?.socket?.remoteAddress);
    return ip ? String(ip) : null;
  } catch {
    return null;
  }
}

function maskIpForDisplay(ip: string | null): string | undefined {
  if (!ip) return undefined;
  const v = String(ip);
  if (v.includes(':')) {
    const parts = v.split(':');
    const head = parts.slice(0, 2).join(':');
    return `${head}::****`;
  }
  const parts = v.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.*`;
  }
  return undefined;
}

// function validateImageContentType removed (no longer used)

/**
 * Fetches all puzzles' public data.
 */
export const getPuzzles = functions.https.onCall(async (_data, _context) => {
  try {
    const snapshot = await db.collection("puzzles")
      .where("isPublished", "==", true)
      .get();
    const puzzles = snapshot.docs.map((doc) => {
      const puzzleData = doc.data() as any;
      const isSolved = Boolean(puzzleData?.isSolved);
      const publicData: Record<string, unknown> = { ...puzzleData };
      // 민감 정보는 항상 제거
      delete (publicData as any).recoveryPhrase;
      delete (publicData as any).revealImageUrl;
      delete (publicData as any).imagePath;
      delete (publicData as any).revealImagePath;
      // 정답은 퍼즐이 해결된 경우에만 공개
      if (!isSolved) {
        delete (publicData as any).answer;
      }
      return publicData;
    });
    // Sort by id ascending without requiring Firestore composite index
    puzzles.sort((a: any, b: any) => Number(a.id) - Number(b.id));
    return puzzles;
  } catch (error) {
    functions.logger.error("Error fetching puzzles:", error);
    throw new functions.https.HttpsError("internal", "Could not fetch puzzles.");
  }
});

/**
 * Checks a user's submitted answer for a specific puzzle.
 */
export const checkAnswer = functions.https.onCall(async (data: any, _context) => {
  try {
    if (!data || typeof data.puzzleId === "undefined" || typeof data.guess === "undefined") {
      throw new functions.https.HttpsError("invalid-argument", "The function must be called with 'puzzleId' and 'guess' arguments.");
    }
    const {puzzleId, guess} = data;
    const query = await db.collection("puzzles").where("id", "==", puzzleId).limit(1).get();
    if (query.empty) {
      throw new functions.https.HttpsError("not-found", "Puzzle not found.");
    }
    const doc = query.docs[0];
    const puzzle = doc.data() as any;

    // Validate answer first
    const isCorrect = guess.trim().toLowerCase() === String(puzzle.answer).toLowerCase();
    if (!isCorrect) {
      // Increment global wrong attempts counter atomically
      try {
        await doc.ref.update({ wrongAttempts: admin.firestore.FieldValue.increment(1) });
      } catch (incErr) {
        functions.logger.warn('Failed to increment wrongAttempts', incErr as any);
      }
      // Use failed-precondition to avoid misleading 401 Unauthorized in network logs
      throw new functions.https.HttpsError("failed-precondition", "Incorrect answer. Please try again.");
    }

    // Atomically mark solved only once
    const firstSolver = await db.runTransaction(async (tx) => {
      const snap = await tx.get(doc.ref);
      const d = snap.data() as any;
      if (!d?.isSolved) {
        tx.update(doc.ref, { isSolved: true, solvedAt: admin.firestore.FieldValue.serverTimestamp() });
        return true;
      }
      return false;
    });

    if (!firstSolver) {
      return { type: 'already_solved' };
    }

    const rewardType = puzzle.rewardType || 'metamask';
    if (rewardType === 'metamask') {
      return { type: 'metamask', recoveryPhrase: puzzle.recoveryPhrase };
    }
    if (rewardType === 'image') {
      return { type: 'image', revealImageUrl: puzzle.revealImageUrl };
    }
    if (rewardType === 'text') {
      return { type: 'text', revealText: puzzle.revealText || '' };
    }
    return { type: 'image', revealImageUrl: puzzle.revealImageUrl };
  } catch (error) {
    functions.logger.error("!!! CRITICAL ERROR in checkAnswer !!!:", error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", "An unexpected error occurred inside the function.");
  }
});

/**
 * Utility to assert the caller is authenticated and has admin claim.
 */
/**
 * Ensures the caller is authenticated with an admin custom claim.
 * @param {functions.https.CallableContext} context - Callable context from Firebase Functions
 */
function assertIsAdmin(context: functions.https.CallableContext) {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
  }
  const isAdmin = Boolean((context.auth.token as any)?.admin);
  if (!isAdmin) {
    throw new functions.https.HttpsError("permission-denied", "Admin privileges required.");
  }
}

/**
 * Returns all puzzles including sensitive fields for admins.
 * @param {_data} _data - Unused request payload
 * @param {functions.https.CallableContext} context - Callable context for auth/claims
 */
export const getAllPuzzlesAdmin = functions.https.onCall(async (_data, context) => {
  assertIsAdmin(context);
  try {
    const snapshot = await db.collection("puzzles").orderBy("id", "asc").get();
    const puzzles = snapshot.docs.map((doc) => ({
      docId: doc.id,
      ...doc.data(),
    }));
    return puzzles;
  } catch (error) {
    functions.logger.error("Error fetching all puzzles (admin):", error);
    throw new functions.https.HttpsError("internal", "Could not fetch puzzles.");
  }
});

/**
 * Creates a new puzzle document. Admin only.
 * @param {Record<string, unknown>} data - Puzzle fields
 * @param {functions.https.CallableContext} context - Callable context for auth/claims
 */
export const createPuzzleAdmin = functions.https.onCall(async (data: any, context) => {
  assertIsAdmin(context);
  try {
    const baseRequired = ["id", "imageUrl", "rewardAmount", "answer", "rewardType"];
    for (const field of baseRequired) {
      if (typeof data[field] === "undefined" || data[field] === null) {
        throw new functions.https.HttpsError("invalid-argument", `Missing required field: ${field}`);
      }
    }
    const rewardType = String(data.rewardType);
    if (rewardType === 'metamask') {
      const mmFields = ["walletaddress", "explorerLink", "recoveryPhrase"];
      for (const field of mmFields) {
        if (typeof data[field] === "undefined" || data[field] === null) {
          throw new functions.https.HttpsError("invalid-argument", `Missing required field for metamask: ${field}`);
        }
      }
    } else if (rewardType === 'image') {
      if (!data.revealImageUrl) {
        throw new functions.https.HttpsError("invalid-argument", "Missing required field for image reward: revealImageUrl");
      }
    } else if (rewardType === 'text') {
      if (!data.revealText) {
        throw new functions.https.HttpsError("invalid-argument", "Missing required field for text reward: revealText");
      }
    } else {
      throw new functions.https.HttpsError("invalid-argument", "Invalid rewardType. Expected 'metamask' or 'image'.");
    }

    // Ensure unique `id` across puzzles
    const existing = await db.collection("puzzles").where("id", "==", data.id).limit(1).get();
    if (!existing.empty) {
      throw new functions.https.HttpsError("already-exists", "A puzzle with the same id already exists.");
    }

    const puzzleDoc: any = {
      id: Number(data.id),
      imageUrl: String(data.imageUrl),
      rewardAmount: String(data.rewardAmount),
      isSolved: Boolean(data.isSolved ?? false),
      isPublished: Boolean(data.isPublished ?? false),
      wrongAttempts: Number(data.wrongAttempts ?? 0),
      answer: String(data.answer),
      rewardType,
    };

    if (typeof data.puzzleType !== 'undefined' && data.puzzleType !== null) {
      puzzleDoc.puzzleType = String(data.puzzleType).slice(0, 32);
    }
    if (typeof (data as any).puzzleName !== 'undefined' && (data as any).puzzleName !== null) {
      puzzleDoc.puzzleName = String((data as any).puzzleName).slice(0, 60);
    }

    if (data.imagePath) {
      puzzleDoc.imagePath = String(data.imagePath);
    }

    if (rewardType === 'metamask') {
      puzzleDoc.walletaddress = String(data.walletaddress);
      puzzleDoc.explorerLink = String(data.explorerLink);
      puzzleDoc.recoveryPhrase = String(data.recoveryPhrase);
    } else if (rewardType === 'image') {
      puzzleDoc.revealImageUrl = String(data.revealImageUrl);
      if (data.revealImagePath) {
        puzzleDoc.revealImagePath = String(data.revealImagePath);
      }
      // Optional fields may be empty in this mode
      if (data.walletaddress) puzzleDoc.walletaddress = String(data.walletaddress);
      if (data.explorerLink) puzzleDoc.explorerLink = String(data.explorerLink);
    } else if (rewardType === 'text') {
      puzzleDoc.revealText = String(data.revealText);
      if (data.walletaddress) puzzleDoc.walletaddress = String(data.walletaddress);
      if (data.explorerLink) puzzleDoc.explorerLink = String(data.explorerLink);
    }

    const ref = await db.collection("puzzles").add(puzzleDoc);
    return {success: true, docId: ref.id};
  } catch (error) {
    functions.logger.error("Error creating puzzle (admin):", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", "Failed to create puzzle.");
  }
});

/**
 * Updates an existing puzzle document by `id`. Admin only.
 * @param {Record<string, unknown>} data - Update payload including `id`
 * @param {functions.https.CallableContext} context - Callable context for auth/claims
 */
export const updatePuzzleAdmin = functions.https.onCall(async (data: any, context) => {
  assertIsAdmin(context);
  try {
    if (typeof data.id === "undefined") {
      throw new functions.https.HttpsError("invalid-argument", "Missing required field: id");
    }

    const snapshot = await db.collection("puzzles").where("id", "==", data.id).limit(1).get();
    if (snapshot.empty) {
      throw new functions.https.HttpsError("not-found", "Puzzle not found.");
    }
    const ref = snapshot.docs[0].ref;

    const updatableFields = [
      "id",
      "level",
      "imageUrl",
      "imagePath",
      "walletaddress",
      "rewardAmount",
      "explorerLink",
      "isSolved",
      "isPublished",
      "answer",
      "recoveryPhrase",
      "rewardType",
      "revealImageUrl",
      "revealImagePath",
      "revealText",
      "wrongAttempts",
      "solverName",
      "puzzleType",
      "puzzleName",
    ];
    const updatePayload: Record<string, unknown> = {};
    for (const field of updatableFields) {
      if (typeof data[field] !== "undefined") {
        updatePayload[field] = data[field];
      }
    }
    if (Object.keys(updatePayload).length === 0) {
      return {success: true, updated: false};
    }

    await ref.update(updatePayload);
    return {success: true, updated: true};
  } catch (error) {
    functions.logger.error("Error updating puzzle (admin):", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", "Failed to update puzzle.");
  }
});

/**
 * Deletes a puzzle by `id`. Admin only.
 * @param {{id: number}} data - Identifier of the puzzle
 * @param {functions.https.CallableContext} context - Callable context for auth/claims
 */
export const deletePuzzleAdmin = functions.https.onCall(async (data: any, context) => {
  assertIsAdmin(context);
  try {
    if (typeof data.id === "undefined") {
      throw new functions.https.HttpsError("invalid-argument", "Missing required field: id");
    }
    const snapshot = await db.collection("puzzles").where("id", "==", data.id).limit(1).get();
    if (snapshot.empty) {
      throw new functions.https.HttpsError("not-found", "Puzzle not found.");
    }
    const doc = snapshot.docs[0];
    const puzzle = doc.data() as any;

    // Try to delete associated Storage files
    const bucket = getDefaultBucket();
    const candidates: Array<string | null> = [
      extractStoragePath(puzzle.imagePath) || extractStoragePath(puzzle.imageUrl),
      extractStoragePath(puzzle.revealImagePath) || extractStoragePath(puzzle.revealImageUrl),
    ];
    for (const path of candidates) {
      if (!path) continue;
      try {
        await bucket.file(path).delete({ ignoreNotFound: true });
        functions.logger.info(`Deleted storage object: ${path}`);
      } catch (err) {
        functions.logger.warn(`Failed to delete storage object ${path}`, err as any);
      }
    }

    await doc.ref.delete();
    return {success: true};
  } catch (error) {
    functions.logger.error("Error deleting puzzle (admin):", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", "Failed to delete puzzle.");
  }
});

/**
 * Batch update multiple puzzles by id. Admin only.
 * @param {{updates: Array<Record<string, unknown>>}} data - Each item must include `id` and fields to update
 */
export const updatePuzzlesBatchAdmin = functions.https.onCall(async (data: any, context) => {
  assertIsAdmin(context);
  try {
    const updates = (data?.updates as Array<Record<string, unknown>>) || [];
    if (!Array.isArray(updates) || updates.length === 0) {
      throw new functions.https.HttpsError("invalid-argument", "updates must be a non-empty array");
    }
    const batch = db.batch();
    for (const item of updates) {
      const id = (item as any)?.id;
      if (typeof id === 'undefined') {
        throw new functions.https.HttpsError("invalid-argument", "Each update must include id");
      }
      const snap = await db.collection("puzzles").where("id", "==", id).limit(1).get();
      if (snap.empty) continue;
      const ref = snap.docs[0].ref;
      const payload: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(item)) {
        if (k === 'id') continue;
        payload[k] = v;
      }
      if (Object.keys(payload).length > 0) {
        batch.update(ref, payload);
      }
    }
    await batch.commit();
    return { success: true };
  } catch (error) {
    functions.logger.error("Error in updatePuzzlesBatchAdmin:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", "Failed to batch update puzzles.");
  }
});

/**
 * Batch delete puzzles by ids. Admin only.
 * @param {{ids: number[]}} data
 */
export const deletePuzzlesBatchAdmin = functions.https.onCall(async (data: any, context) => {
  assertIsAdmin(context);
  try {
    const ids = (data?.ids as number[]) || [];
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new functions.https.HttpsError("invalid-argument", "ids must be a non-empty array");
    }
    const batch = db.batch();
    for (const id of ids) {
      const snap = await db.collection("puzzles").where("id", "==", id).limit(1).get();
      if (snap.empty) continue;
      batch.delete(snap.docs[0].ref);
    }
    await batch.commit();
    return { success: true };
  } catch (error) {
    functions.logger.error("Error in deletePuzzlesBatchAdmin:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", "Failed to batch delete puzzles.");
  }
});
/**
 * Sets the solved status for a puzzle by `id`. Admin only.
 * @param {{id: number, isSolved: boolean}} data - Target puzzle id and status
 * @param {functions.https.CallableContext} context - Callable context for auth/claims
 */
export const setPuzzleSolvedAdmin = functions.https.onCall(async (data: any, context) => {
  assertIsAdmin(context);
  try {
    if (typeof data.id === "undefined" || typeof data.isSolved === "undefined") {
      throw new functions.https.HttpsError("invalid-argument", "Missing required fields: id, isSolved");
    }
    const snapshot = await db.collection("puzzles").where("id", "==", data.id).limit(1).get();
    if (snapshot.empty) {
      throw new functions.https.HttpsError("not-found", "Puzzle not found.");
    }
    await snapshot.docs[0].ref.update({isSolved: Boolean(data.isSolved)});
    return {success: true};
  } catch (error) {
    functions.logger.error("Error setting solved status (admin):", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", "Failed to set solved status.");
  }
});

/**
 * Grants admin role to a user by email using a shared secret set in functions config.
 * Usage: firebase functions:config:set admin.secret="YOUR_LONG_RANDOM_SECRET"
 * @param {{email: string, secret: string}} data - Target email and admin secret
 * @param {functions.https.CallableContext} _context - Callable context (unused)
 */
// grantAdminRole removed per product decision

/**
 * Uploads an image to Firebase Storage on behalf of an admin user.
 * @param {{path: string, contentType: string, base64: string}} data
 * @param {functions.https.CallableContext} context
 */
export const uploadImageAdmin = functions.https.onCall(async (data: any, context) => {
  assertIsAdmin(context);
  try {
    const { path, contentType, base64 } = data || {};
    if (!path || !contentType || !base64) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Missing required fields: path, contentType, base64"
      );
    }
    const bucket = admin.storage().bucket();
    const file = bucket.file(path);
    const buffer = Buffer.from(base64, 'base64');
    await file.save(buffer, { contentType, resumable: false, public: true, metadata: { cacheControl: 'public, max-age=31536000' } });
    const encodedName = encodeURIComponent(path);
    const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedName}?alt=media`;
    return { success: true, url: publicUrl };
  } catch (error) {
    functions.logger.error('Error in uploadImageAdmin:', error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', 'Failed to upload image.');
  }
});

/**
 * Board: Public image upload (no auth). Stores under board/ and returns public URL.
 */
// Image upload removed by requirements

/**
 * Board: Create post with password protection.
 */
export const addBoardPost = functions.https.onCall(async (data: any, _context) => {
  try {
    const { title, content, password } = data || {};
    const categoryRaw = (data?.category ?? '일반') as string;
    const allowedCategories = ['일반','퍼즐'];
    const category = allowedCategories.includes(categoryRaw) ? categoryRaw : '일반';
    const t = String(title || '').trim();
    const c = String(content || '').trim();
    const p = String(password || '').trim();
    if (!t || !c || !p) throw new functions.https.HttpsError('invalid-argument', 'title, content, password are required');
    if (t.length > 80) throw new functions.https.HttpsError('invalid-argument', 'title too long');
    if (c.length > 5000) throw new functions.https.HttpsError('invalid-argument', 'content too long');
    const { salt, hash } = hashPassword(p);
    const payload = {
      title: t,
      content: c,
      imageUrls: [],
      category,
      commentCount: 0,
      comments: [],
      isPinned: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      passwordSalt: salt,
      passwordHash: hash,
    } as any;
    const ref = await db.collection('boardPosts').add(payload);
    return { success: true, id: ref.id };
  } catch (error) {
    functions.logger.error('addBoardPost error', error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', 'Failed to add post');
  }
});

/** Fetch posts (public). */
export const getBoardPosts = functions.https.onCall(async (data: any, _context) => {
  try {
    const { limit = 30, id, category, startAfter } = data || {};
    if (id) {
      const snap = await db.collection('boardPosts').doc(String(id)).get();
      if (!snap.exists) throw new functions.https.HttpsError('not-found', 'Post not found');
      const d = snap.data() as any;
      delete d.passwordHash; delete d.passwordSalt;
      const createdAtMillis = (d.createdAt as FirebaseFirestore.Timestamp | undefined)?.toMillis?.() || (snap.createTime as any)?.toMillis?.() || (snap.updateTime as any)?.toMillis?.();
      const derivedLen = Array.isArray(d.comments) ? d.comments.length : 0;
      const commentCount = Math.max(Number(d.commentCount || 0), derivedLen);
      return { id: snap.id, ...d, commentCount, createdAtMillis };
    }
    // Note: Avoid composite index requirement by not combining where(category) with orderBy(createdAt).
    // We'll filter in memory after fetching a slightly larger page.
    let query: FirebaseFirestore.Query = db.collection('boardPosts')
      .orderBy('createdAt', 'desc');
    if (startAfter) {
      const ts = typeof startAfter === 'number' ? admin.firestore.Timestamp.fromMillis(startAfter) : admin.firestore.Timestamp.now();
      query = query.startAfter(ts);
    }
    // Over-fetch when category filter is applied to compensate for client-side filtering
    const pageLimit = Number(limit);
    const fetchLimit = category ? Math.min(3 * pageLimit, 150) : pageLimit;
    const snap = await query.limit(fetchLimit).get();
    let rawItems = snap.docs.map((doc) => {
      const d = doc.data() as any;
      delete d.passwordHash; delete d.passwordSalt;
      const createdAtMillis = (d.createdAt as FirebaseFirestore.Timestamp | undefined)?.toMillis?.() || (doc.createTime as any)?.toMillis?.() || (doc.updateTime as any)?.toMillis?.();
      const derivedLen = Array.isArray(d.comments) ? d.comments.length : 0;
      const commentCount = Math.max(Number(d.commentCount || 0), derivedLen);
      return { id: doc.id, title: d.title, createdAt: d.createdAt, createdAtMillis, category: d.category || '일반', commentCount, comments: d.comments || [], isPinned: Boolean(d.isPinned) };
    });

    // Fetch pinned posts separately (no orderBy to avoid composite index), only on first page
    let pinnedItems: any[] = [];
    if (!startAfter) {
      const pinnedSnap = await db.collection('boardPosts').where('isPinned', '==', true).limit(50).get();
      pinnedItems = pinnedSnap.docs.map((doc) => {
        const d = doc.data() as any;
        delete d.passwordHash; delete d.passwordSalt;
        const createdAtMillis = (d.createdAt as FirebaseFirestore.Timestamp | undefined)?.toMillis?.() || (doc.createTime as any)?.toMillis?.() || (doc.updateTime as any)?.toMillis?.();
        const derivedLen = Array.isArray(d.comments) ? d.comments.length : 0;
        const commentCount = Math.max(Number(d.commentCount || 0), derivedLen);
        return { id: doc.id, title: d.title, createdAt: d.createdAt, createdAtMillis, category: d.category || '일반', commentCount, comments: d.comments || [], isPinned: true };
      });
      // Sort pinned by createdAt desc in-memory
      pinnedItems.sort((a, b) => (Number(b.createdAtMillis || 0) - Number(a.createdAtMillis || 0)));
    }
    if (category) {
      rawItems = rawItems.filter((it: any) => String(it.category) === String(category));
    }
    // Merge pinned (first) + recent (excluding duplicates)
    const pinnedIds = new Set(pinnedItems.map((it: any) => String(it.id)));
    const nonPinned = rawItems.filter((it: any) => !pinnedIds.has(String(it.id)));
    const merged = [...pinnedItems, ...nonPinned];
    const items = merged.slice(0, pageLimit);
    const last = snap.docs[snap.docs.length - 1];
    const nextCursor = last ? (last.get('createdAt') as FirebaseFirestore.Timestamp)?.toMillis?.() : null;
    return { items, nextCursor };
  } catch (error) {
    functions.logger.error('getBoardPosts error', error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', 'Failed to fetch posts');
  }
});

/** Update post with password verification. */
export const updateBoardPost = functions.https.onCall(async (data: any, _context) => {
  try {
    const { id, password, title, content, imageUrls } = data || {};
    if (!id || !password) throw new functions.https.HttpsError('invalid-argument', 'id and password required');
    const ref = db.collection('boardPosts').doc(String(id));
    const snap = await ref.get();
    if (!snap.exists) throw new functions.https.HttpsError('not-found', 'Post not found');
    const d = snap.data() as any;
    const { hash } = hashPassword(String(password), d.passwordSalt);
    if (hash !== d.passwordHash) throw new functions.https.HttpsError('permission-denied', 'Invalid password');
    const update: any = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    if (typeof title !== 'undefined') update.title = String(title).slice(0, 80);
    if (typeof content !== 'undefined') update.content = String(content).slice(0, 5000);
    if (Array.isArray(imageUrls)) update.imageUrls = imageUrls.map((u: any) => String(u)).slice(0, 6);
    await ref.update(update);
    return { success: true };
  } catch (error) {
    functions.logger.error('updateBoardPost error', error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', 'Failed to update post');
  }
});

/** Verify a post password without updating. Returns { ok: true } when valid */
export const verifyBoardPostPassword = functions.https.onCall(async (data: any, _context) => {
  try {
    const { id, password } = data || {};
    if (!id || !password) throw new functions.https.HttpsError('invalid-argument', 'id and password required');
    const ref = db.collection('boardPosts').doc(String(id));
    const snap = await ref.get();
    if (!snap.exists) throw new functions.https.HttpsError('not-found', 'Post not found');
    const d = snap.data() as any;
    const { hash } = hashPassword(String(password), d.passwordSalt);
    if (hash !== d.passwordHash) throw new functions.https.HttpsError('permission-denied', 'Invalid password');
    return { ok: true };
  } catch (error) {
    functions.logger.error('verifyBoardPostPassword error', error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', 'Failed to verify password');
  }
});

/** Delete post with password verification; try deleting images. */
export const deleteBoardPost = functions.https.onCall(async (data: any, _context) => {
  try {
    const { id, password } = data || {};
    if (!id || !password) throw new functions.https.HttpsError('invalid-argument', 'id and password required');
    const ref = db.collection('boardPosts').doc(String(id));
    const snap = await ref.get();
    if (!snap.exists) throw new functions.https.HttpsError('not-found', 'Post not found');
    const d = snap.data() as any;
    const { hash } = hashPassword(String(password), d.passwordSalt);
    if (hash !== d.passwordHash) throw new functions.https.HttpsError('permission-denied', 'Invalid password');
    // delete images if in our bucket
    try {
      const bucket = getDefaultBucket();
      const imgs: string[] = Array.isArray(d.imageUrls) ? d.imageUrls : [];
      for (const u of imgs) {
        const path = extractStoragePath(String(u));
        if (path) await bucket.file(path).delete({ ignoreNotFound: true });
      }
    } catch (err) {
      functions.logger.warn('Failed to delete board images', err as any);
    }
    await ref.delete();
    return { success: true };
  } catch (error) {
    functions.logger.error('deleteBoardPost error', error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', 'Failed to delete post');
  }
});

/** Admin: Fetch posts with full fields (no passwords), supports limit & category */
export const getBoardPostsAdmin = functions.https.onCall(async (data: any, context) => {
  assertIsAdmin(context);
  try {
    const { limit = 50, category } = data || {};
    let query: FirebaseFirestore.Query = db.collection('boardPosts')
      .orderBy('createdAt', 'desc');
    const snap = await query.limit(Number(limit)).get();
    let items = snap.docs.map((doc) => {
      const d = doc.data() as any;
      delete d.passwordHash; delete d.passwordSalt;
      const createdAtMillis = (d.createdAt as FirebaseFirestore.Timestamp | undefined)?.toMillis?.() || (doc.createTime as any)?.toMillis?.() || (doc.updateTime as any)?.toMillis?.();
      const derivedLen = Array.isArray(d.comments) ? d.comments.length : 0;
      const commentCount = Math.max(Number(d.commentCount || 0), derivedLen);
      return { id: doc.id, ...d, commentCount, createdAtMillis, isPinned: Boolean(d.isPinned) };
    });
    if (category) {
      items = items.filter((it: any) => String(it.category) === String(category));
    }
    return { items };
  } catch (error) {
    functions.logger.error('getBoardPostsAdmin error', error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', 'Failed to fetch posts (admin)');
  }
});

/** Admin: Update post without password; can set isPinned */
export const updateBoardPostAdmin = functions.https.onCall(async (data: any, context) => {
  assertIsAdmin(context);
  try {
    const { id } = data || {};
    if (!id) throw new functions.https.HttpsError('invalid-argument', 'id is required');
    const ref = db.collection('boardPosts').doc(String(id));
    const snap = await ref.get();
    if (!snap.exists) throw new functions.https.HttpsError('not-found', 'Post not found');
    const update: any = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    if (typeof data.title !== 'undefined') update.title = String(data.title).slice(0, 80);
    if (typeof data.content !== 'undefined') update.content = String(data.content).slice(0, 5000);
    if (typeof data.category !== 'undefined') update.category = String(data.category);
    if (Array.isArray(data.imageUrls)) update.imageUrls = (data.imageUrls as any[]).map((u) => String(u)).slice(0, 6);
    if (typeof data.isPinned !== 'undefined') update.isPinned = Boolean(data.isPinned);
    await ref.update(update);
    return { success: true };
  } catch (error) {
    functions.logger.error('updateBoardPostAdmin error', error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', 'Failed to update post (admin)');
  }
});

/** Admin: Delete post without password; also deletes images if any */
export const deleteBoardPostAdmin = functions.https.onCall(async (data: any, context) => {
  assertIsAdmin(context);
  try {
    const { id } = data || {};
    if (!id) throw new functions.https.HttpsError('invalid-argument', 'id is required');
    const ref = db.collection('boardPosts').doc(String(id));
    const snap = await ref.get();
    if (!snap.exists) throw new functions.https.HttpsError('not-found', 'Post not found');
    const d = snap.data() as any;
    try {
      const bucket = getDefaultBucket();
      const imgs: string[] = Array.isArray(d.imageUrls) ? d.imageUrls : [];
      for (const u of imgs) {
        const path = extractStoragePath(String(u));
        if (path) await bucket.file(path).delete({ ignoreNotFound: true });
      }
    } catch (err) {
      functions.logger.warn('Failed to delete board images (admin)', err as any);
    }
    await ref.delete();
    return { success: true };
  } catch (error) {
    functions.logger.error('deleteBoardPostAdmin error', error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', 'Failed to delete post (admin)');
  }
});

/** Add a comment with nickname and password */
export const addBoardComment = functions.https.onCall(async (data: any, context) => {
  try {
    const { id, nickname, content, password } = data || {};
    const ref = db.collection('boardPosts').doc(String(id));
    // Best-effort client IP extraction from callable context
    // rawRequest is available on callable context
    const ipMasked = (() => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawReq: any = (context as any)?.rawRequest;
        const ip = extractClientIp(rawReq);
        return maskIpForDisplay(ip);
      } catch {
        return undefined;
      }
    })();
    
    const result = await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(ref);
      if (!snap.exists) throw new functions.https.HttpsError('not-found', 'Post not found');
      
      const name = String(nickname || '').trim().slice(0, 24);
      const text = String(content || '').trim().slice(0, 1000);
      const pw = String(password || '').trim();
      if (!name || !text || !pw) throw new functions.https.HttpsError('invalid-argument', 'nickname, content, password required');
      
      const { salt, hash } = hashPassword(pw);
      const comment = { 
        id: String(Date.now()) + Math.random().toString(36).slice(2), 
        nickname: name, 
        content: text, 
        createdAt: admin.firestore.Timestamp.now(), 
        passwordSalt: salt, 
        passwordHash: hash,
        ipMasked
      };
      
      const currentData = snap.data() as any;
      const currentComments = Array.isArray(currentData?.comments) ? currentData.comments : [];
      const newComments = [...currentComments, comment];
      const newCount = newComments.length;
      
      transaction.update(ref, { 
        comments: newComments, 
        commentCount: newCount,
        updatedAt: admin.firestore.FieldValue.serverTimestamp() 
      });
      
      return { success: true };
    });
    
    return result;
  } catch (error) {
    functions.logger.error('addBoardComment error', error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', 'Failed to add comment');
  }
});

/** Delete a comment with password verification */
export const deleteBoardComment = functions.https.onCall(async (data: any, _context) => {
  try {
    const { id, commentId, password } = data || {};
    const ref = db.collection('boardPosts').doc(String(id));
    
    const result = await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(ref);
      if (!snap.exists) throw new functions.https.HttpsError('not-found', 'Post not found');
      
      const d = snap.data() as any;
      const target = (d.comments || []).find((c: any) => c.id === String(commentId));
      if (!target) throw new functions.https.HttpsError('not-found', 'Comment not found');
      
      const { hash } = hashPassword(String(password || ''), target.passwordSalt);
      if (hash !== target.passwordHash) throw new functions.https.HttpsError('permission-denied', 'Invalid password');
      
      const newComments = (d.comments || []).filter((c: any) => c.id !== String(commentId));
      const newCount = newComments.length;
      
      transaction.update(ref, { 
        comments: newComments, 
        commentCount: newCount,
        updatedAt: admin.firestore.FieldValue.serverTimestamp() 
      });
      
      return { success: true };
    });
    
    return result;
  } catch (error) {
    functions.logger.error('deleteBoardComment error', error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', 'Failed to delete comment');
  }
});

/**
 * Returns the answer for a puzzle only if it has already been solved.
 * This allows clients to display the correct answer on solved cards
 * even if the initial listing omitted the answer field.
 */
export const getSolvedAnswer = functions.https.onCall(async (data: any, _context) => {
  try {
    const { puzzleId } = data || {};
    if (typeof puzzleId === 'undefined') {
      throw new functions.https.HttpsError('invalid-argument', 'puzzleId is required');
    }
    const snapshot = await db.collection('puzzles').where('id', '==', puzzleId).limit(1).get();
    if (snapshot.empty) {
      throw new functions.https.HttpsError('not-found', 'Puzzle not found');
    }
    const puzzle = snapshot.docs[0].data() as any;
    if (!puzzle?.isSolved) {
      throw new functions.https.HttpsError('permission-denied', 'Answer is only available after the puzzle is solved');
    }
    return { answer: String(puzzle.answer ?? '') };
  } catch (error) {
    functions.logger.error('Error in getSolvedAnswer:', error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', 'Failed to get answer');
  }
});

/**
 * Sets or updates the solver's display name for a puzzle.
 * This is optional and can be moderated by admins.
 */
export const setSolverName = functions.https.onCall(async (data: any, _context) => {
  try {
    const { puzzleId, name } = data || {};
    if (typeof puzzleId === 'undefined' || typeof name === 'undefined') {
      throw new functions.https.HttpsError('invalid-argument', 'puzzleId and name are required');
    }
    const trimmed = String(name).trim();
    if (!trimmed) {
      throw new functions.https.HttpsError('invalid-argument', 'Name must not be empty');
    }
    // Basic sanitation and length limit
    const sanitized = trimmed.replace(/[\r\n\t]/g, ' ').slice(0, 40);
    const snap = await db.collection('puzzles').where('id', '==', puzzleId).limit(1).get();
    if (snap.empty) {
      throw new functions.https.HttpsError('not-found', 'Puzzle not found');
    }
    const ref = snap.docs[0].ref;
    await ref.update({ solverName: sanitized, solverNamedAt: admin.firestore.FieldValue.serverTimestamp() });
    return { success: true };
  } catch (error) {
    functions.logger.error('Error in setSolverName:', error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', 'Failed to set solver name');
  }
});

/**
 * Fix commentCount for all board posts (one-time migration)
 */
export const fixCommentCounts = functions.https.onCall(async (_data, _context) => {
  try {
    const snapshot = await db.collection('boardPosts').get();
    const batch = db.batch();
    let updated = 0;
    
    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      const commentsLength = Array.isArray(data.comments) ? data.comments.length : 0;
      const currentCount = Number(data.commentCount || 0);
      
      if (currentCount !== commentsLength) {
        batch.update(doc.ref, { commentCount: commentsLength });
        updated++;
      }
    });
    
    if (updated > 0) {
      await batch.commit();
    }
    
    return { success: true, updated };
  } catch (error) {
    functions.logger.error('Error in fixCommentCounts:', error);
    throw new functions.https.HttpsError('internal', 'Failed to fix comment counts');
  }
});
