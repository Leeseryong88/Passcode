"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadImageAdmin = exports.grantAdminRole = exports.setPuzzleSolvedAdmin = exports.deletePuzzleAdmin = exports.updatePuzzleAdmin = exports.createPuzzleAdmin = exports.getAllPuzzlesAdmin = exports.checkAnswer = exports.getPuzzles = void 0;
/* eslint-disable max-len */
const functions = require("firebase-functions");
const admin = require("firebase-admin");
// Initialize Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();
/**
 * Fetches all puzzles' public data.
 */
exports.getPuzzles = functions.https.onCall(async (_data, _context) => {
    try {
        const snapshot = await db.collection("puzzles").orderBy("level", "asc").get();
        const puzzles = snapshot.docs.map((doc) => {
            const puzzleData = doc.data();
            delete puzzleData.answer;
            delete puzzleData.recoveryPhrase;
            delete puzzleData.revealImageUrl;
            return puzzleData;
        });
        return puzzles;
    }
    catch (error) {
        functions.logger.error("Error fetching puzzles:", error);
        throw new functions.https.HttpsError("internal", "Could not fetch puzzles.");
    }
});
/**
 * Checks a user's submitted answer for a specific puzzle.
 */
exports.checkAnswer = functions.https.onCall(async (data, _context) => {
    try {
        if (!data || typeof data.puzzleId === "undefined" || typeof data.guess === "undefined") {
            throw new functions.https.HttpsError("invalid-argument", "The function must be called with 'puzzleId' and 'guess' arguments.");
        }
        const { puzzleId, guess } = data;
        const snapshot = await db.collection("puzzles").where("id", "==", puzzleId).limit(1).get();
        if (snapshot.empty) {
            throw new functions.https.HttpsError("not-found", "Puzzle not found.");
        }
        const puzzle = snapshot.docs[0].data();
        if (guess.trim().toLowerCase() === String(puzzle.answer).toLowerCase()) {
            if (puzzle.isSolved !== true) {
                const puzzleRef = snapshot.docs[0].ref;
                await puzzleRef.update({ isSolved: true });
            }
            const rewardType = puzzle.rewardType || 'metamask';
            if (rewardType === 'metamask') {
                return { type: 'metamask', recoveryPhrase: puzzle.recoveryPhrase };
            }
            else {
                return { type: 'image', revealImageUrl: puzzle.revealImageUrl };
            }
        }
        else {
            throw new functions.https.HttpsError("unauthenticated", "Incorrect answer. Please try again.");
        }
    }
    catch (error) {
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
function assertIsAdmin(context) {
    var _a;
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
    }
    const isAdmin = Boolean((_a = context.auth.token) === null || _a === void 0 ? void 0 : _a.admin);
    if (!isAdmin) {
        throw new functions.https.HttpsError("permission-denied", "Admin privileges required.");
    }
}
/**
 * Returns all puzzles including sensitive fields for admins.
 * @param {_data} _data - Unused request payload
 * @param {functions.https.CallableContext} context - Callable context for auth/claims
 */
exports.getAllPuzzlesAdmin = functions.https.onCall(async (_data, context) => {
    assertIsAdmin(context);
    try {
        const snapshot = await db.collection("puzzles").orderBy("level", "asc").get();
        const puzzles = snapshot.docs.map((doc) => (Object.assign({ docId: doc.id }, doc.data())));
        return puzzles;
    }
    catch (error) {
        functions.logger.error("Error fetching all puzzles (admin):", error);
        throw new functions.https.HttpsError("internal", "Could not fetch puzzles.");
    }
});
/**
 * Creates a new puzzle document. Admin only.
 * @param {Record<string, unknown>} data - Puzzle fields
 * @param {functions.https.CallableContext} context - Callable context for auth/claims
 */
exports.createPuzzleAdmin = functions.https.onCall(async (data, context) => {
    var _a;
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
        }
        else if (rewardType === 'image') {
            if (!data.revealImageUrl) {
                throw new functions.https.HttpsError("invalid-argument", "Missing required field for image reward: revealImageUrl");
            }
        }
        else {
            throw new functions.https.HttpsError("invalid-argument", "Invalid rewardType. Expected 'metamask' or 'image'.");
        }
        // Ensure unique `id` across puzzles
        const existing = await db.collection("puzzles").where("id", "==", data.id).limit(1).get();
        if (!existing.empty) {
            throw new functions.https.HttpsError("already-exists", "A puzzle with the same id already exists.");
        }
        const puzzleDoc = {
            id: Number(data.id),
            level: Number(data.level),
            imageUrl: String(data.imageUrl),
            rewardAmount: String(data.rewardAmount),
            isSolved: Boolean((_a = data.isSolved) !== null && _a !== void 0 ? _a : false),
            answer: String(data.answer),
            rewardType,
        };
        if (rewardType === 'metamask') {
            puzzleDoc.walletaddress = String(data.walletaddress);
            puzzleDoc.explorerLink = String(data.explorerLink);
            puzzleDoc.recoveryPhrase = String(data.recoveryPhrase);
        }
        else if (rewardType === 'image') {
            puzzleDoc.revealImageUrl = String(data.revealImageUrl);
            // Optional fields may be empty in this mode
            if (data.walletaddress)
                puzzleDoc.walletaddress = String(data.walletaddress);
            if (data.explorerLink)
                puzzleDoc.explorerLink = String(data.explorerLink);
        }
        const ref = await db.collection("puzzles").add(puzzleDoc);
        return { success: true, docId: ref.id };
    }
    catch (error) {
        functions.logger.error("Error creating puzzle (admin):", error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError("internal", "Failed to create puzzle.");
    }
});
/**
 * Updates an existing puzzle document by `id`. Admin only.
 * @param {Record<string, unknown>} data - Update payload including `id`
 * @param {functions.https.CallableContext} context - Callable context for auth/claims
 */
exports.updatePuzzleAdmin = functions.https.onCall(async (data, context) => {
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
            "level",
            "imageUrl",
            "walletaddress",
            "rewardAmount",
            "explorerLink",
            "isSolved",
            "answer",
            "recoveryPhrase",
            "rewardType",
            "revealImageUrl",
        ];
        const updatePayload = {};
        for (const field of updatableFields) {
            if (typeof data[field] !== "undefined") {
                updatePayload[field] = data[field];
            }
        }
        if (Object.keys(updatePayload).length === 0) {
            return { success: true, updated: false };
        }
        await ref.update(updatePayload);
        return { success: true, updated: true };
    }
    catch (error) {
        functions.logger.error("Error updating puzzle (admin):", error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError("internal", "Failed to update puzzle.");
    }
});
/**
 * Deletes a puzzle by `id`. Admin only.
 * @param {{id: number}} data - Identifier of the puzzle
 * @param {functions.https.CallableContext} context - Callable context for auth/claims
 */
exports.deletePuzzleAdmin = functions.https.onCall(async (data, context) => {
    assertIsAdmin(context);
    try {
        if (typeof data.id === "undefined") {
            throw new functions.https.HttpsError("invalid-argument", "Missing required field: id");
        }
        const snapshot = await db.collection("puzzles").where("id", "==", data.id).limit(1).get();
        if (snapshot.empty) {
            throw new functions.https.HttpsError("not-found", "Puzzle not found.");
        }
        await snapshot.docs[0].ref.delete();
        return { success: true };
    }
    catch (error) {
        functions.logger.error("Error deleting puzzle (admin):", error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError("internal", "Failed to delete puzzle.");
    }
});
/**
 * Sets the solved status for a puzzle by `id`. Admin only.
 * @param {{id: number, isSolved: boolean}} data - Target puzzle id and status
 * @param {functions.https.CallableContext} context - Callable context for auth/claims
 */
exports.setPuzzleSolvedAdmin = functions.https.onCall(async (data, context) => {
    assertIsAdmin(context);
    try {
        if (typeof data.id === "undefined" || typeof data.isSolved === "undefined") {
            throw new functions.https.HttpsError("invalid-argument", "Missing required fields: id, isSolved");
        }
        const snapshot = await db.collection("puzzles").where("id", "==", data.id).limit(1).get();
        if (snapshot.empty) {
            throw new functions.https.HttpsError("not-found", "Puzzle not found.");
        }
        await snapshot.docs[0].ref.update({ isSolved: Boolean(data.isSolved) });
        return { success: true };
    }
    catch (error) {
        functions.logger.error("Error setting solved status (admin):", error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError("internal", "Failed to set solved status.");
    }
});
/**
 * Grants admin role to a user by email using a shared secret set in functions config.
 * Usage: firebase functions:config:set admin.secret="YOUR_LONG_RANDOM_SECRET"
 * @param {{email: string, secret: string}} data - Target email and admin secret
 * @param {functions.https.CallableContext} _context - Callable context (unused)
 */
exports.grantAdminRole = functions.https.onCall(async (data, _context) => {
    var _a;
    const secretFromEnv = (((_a = functions.config()) === null || _a === void 0 ? void 0 : _a.admin) && functions.config().admin.secret) || "";
    const providedSecret = String((data === null || data === void 0 ? void 0 : data.secret) || "");
    const targetEmail = String((data === null || data === void 0 ? void 0 : data.email) || "").trim().toLowerCase();
    if (!secretFromEnv) {
        throw new functions.https.HttpsError("failed-precondition", "Admin secret is not configured. Set with: firebase functions:config:set admin.secret=...");
    }
    if (!providedSecret || providedSecret !== secretFromEnv) {
        throw new functions.https.HttpsError("permission-denied", "Invalid admin secret.");
    }
    if (!targetEmail) {
        throw new functions.https.HttpsError("invalid-argument", "Target email is required.");
    }
    try {
        const user = await admin.auth().getUserByEmail(targetEmail);
        const existingClaims = user.customClaims || {};
        await admin.auth().setCustomUserClaims(user.uid, Object.assign(Object.assign({}, existingClaims), { admin: true }));
        return { success: true, uid: user.uid };
    }
    catch (error) {
        functions.logger.error("Error granting admin role:", error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError("internal", "Failed to grant admin role.");
    }
});
/**
 * Uploads an image to Firebase Storage on behalf of an admin user.
 * @param {{path: string, contentType: string, base64: string}} data
 * @param {functions.https.CallableContext} context
 */
exports.uploadImageAdmin = functions.https.onCall(async (data, context) => {
    assertIsAdmin(context);
    try {
        const { path, contentType, base64 } = data || {};
        if (!path || !contentType || !base64) {
            throw new functions.https.HttpsError("invalid-argument", "Missing required fields: path, contentType, base64");
        }
        const bucket = admin.storage().bucket();
        const file = bucket.file(path);
        const buffer = Buffer.from(base64, 'base64');
        await file.save(buffer, { contentType, resumable: false, public: true, metadata: { cacheControl: 'public, max-age=31536000' } });
        const encodedName = encodeURIComponent(path);
        const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedName}?alt=media`;
        return { success: true, url: publicUrl };
    }
    catch (error) {
        functions.logger.error('Error in uploadImageAdmin:', error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', 'Failed to upload image.');
    }
});
//# sourceMappingURL=index.js.map