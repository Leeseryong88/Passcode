/* eslint-disable max-len */
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

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

/**
 * Fetches all puzzles' public data.
 */
export const getPuzzles = functions.https.onCall(async (_data, _context) => {
  try {
    const snapshot = await db.collection("puzzles")
      .where("isPublished", "==", true)
      .orderBy("level", "asc")
      .get();
    const puzzles = snapshot.docs.map((doc) => {
      const puzzleData = doc.data();
      delete puzzleData.answer;
      delete puzzleData.recoveryPhrase;
      delete puzzleData.revealImageUrl;
      delete puzzleData.imagePath;
      delete puzzleData.revealImagePath;
      return puzzleData;
    });
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
    const snapshot = await db.collection("puzzles").where("id", "==", puzzleId).limit(1).get();
    if (snapshot.empty) {
      throw new functions.https.HttpsError("not-found", "Puzzle not found.");
    }
    const puzzle = snapshot.docs[0].data() as any;
    if (guess.trim().toLowerCase() === String(puzzle.answer).toLowerCase()) {
      if (puzzle.isSolved !== true) {
        const puzzleRef = snapshot.docs[0].ref;
        await puzzleRef.update({isSolved: true});
      }
      const rewardType = puzzle.rewardType || 'metamask';
      if (rewardType === 'metamask') {
        return { type: 'metamask', recoveryPhrase: puzzle.recoveryPhrase };
      } else {
        // Return stored URL directly. Ensure Storage rules permit public read for rewards/**.
        return { type: 'image', revealImageUrl: puzzle.revealImageUrl };
      }
    } else {
      throw new functions.https.HttpsError("unauthenticated", "Incorrect answer. Please try again.");
    }
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
    const snapshot = await db.collection("puzzles").orderBy("level", "asc").get();
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
    const baseRequired = ["id", "level", "imageUrl", "rewardAmount", "answer", "rewardType"];
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
      level: Number(data.level),
      imageUrl: String(data.imageUrl),
      imagePath: data.imagePath ? String(data.imagePath) : undefined,
      rewardAmount: String(data.rewardAmount),
      isSolved: Boolean(data.isSolved ?? false),
      isPublished: Boolean(data.isPublished ?? false),
      answer: String(data.answer),
      rewardType,
    };
    if (rewardType === 'metamask') {
      puzzleDoc.walletaddress = String(data.walletaddress);
      puzzleDoc.explorerLink = String(data.explorerLink);
      puzzleDoc.recoveryPhrase = String(data.recoveryPhrase);
    } else if (rewardType === 'image') {
      puzzleDoc.revealImageUrl = String(data.revealImageUrl);
      puzzleDoc.revealImagePath = data.revealImagePath ? String(data.revealImagePath) : undefined;
      // Optional fields may be empty in this mode
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
export const grantAdminRole = functions.https.onCall(async (data: any, context) => {
  // Require authenticated admin caller AND shared secret
  assertIsAdmin(context);
  const secretFromEnv = (functions.config()?.admin && (functions.config().admin as any).secret) || "";
  const providedSecret = String(data?.secret || "");
  const targetEmail = String(data?.email || "").trim().toLowerCase();

  if (!secretFromEnv) {
    throw new functions.https.HttpsError(
        "failed-precondition",
        "Admin secret is not configured. Set with: firebase functions:config:set admin.secret=..."
    );
  }
  if (!providedSecret || providedSecret !== secretFromEnv) {
    throw new functions.https.HttpsError("permission-denied", "Invalid admin secret.");
  }
  if (!targetEmail) {
    throw new functions.https.HttpsError("invalid-argument", "Target email is required.");
  }

  try {
    const user = await admin.auth().getUserByEmail(targetEmail);
    const existingClaims = (user.customClaims as Record<string, unknown>) || {};
    await admin.auth().setCustomUserClaims(user.uid, {...existingClaims, admin: true});
    return {success: true, uid: user.uid};
  } catch (error) {
    functions.logger.error("Error granting admin role:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError("internal", "Failed to grant admin role.");
  }
});

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
