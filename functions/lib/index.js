"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setSolverName = exports.getSolvedAnswer = exports.deleteBoardPost = exports.updateBoardPost = exports.getBoardPosts = exports.addBoardPost = exports.uploadBoardImage = exports.uploadImageAdmin = exports.setPuzzleSolvedAdmin = exports.deletePuzzlesBatchAdmin = exports.updatePuzzlesBatchAdmin = exports.deletePuzzleAdmin = exports.updatePuzzleAdmin = exports.createPuzzleAdmin = exports.getAllPuzzlesAdmin = exports.checkAnswer = exports.getPuzzles = void 0;
/* eslint-disable max-len */
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const crypto_1 = require("crypto");
// Initialize Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();
function getDefaultBucket() {
    var _a;
    const configured = (_a = admin.app().options) === null || _a === void 0 ? void 0 : _a.storageBucket;
    const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
    const fallback = projectId ? `${projectId}.appspot.com` : undefined;
    return admin.storage().bucket(configured || fallback);
}
function extractStoragePath(value) {
    if (!value)
        return null;
    const v = String(value);
    // Match firebase public URL: .../o/<object>?...
    let m = v.match(/\/o\/([^?]+)/);
    if (m && m[1])
        return decodeURIComponent(m[1]);
    // Match storage.googleapis.com/<bucket>/<object>
    m = v.match(/storage\.googleapis\.com\/(?:[^/]+)\/(.+)$/);
    if (m && m[1])
        return decodeURIComponent(m[1]);
    // Match gs://<bucket>/<object>
    m = v.match(/^gs:\/\/[^/]+\/(.+)$/);
    if (m && m[1])
        return decodeURIComponent(m[1]);
    // Direct path
    if (/^(puzzles|rewards)\//.test(v))
        return v;
    return null;
}
function hashPassword(raw, salt) {
    const s = salt || (0, crypto_1.randomBytes)(8).toString('hex');
    const h = (0, crypto_1.createHash)('sha256').update(`${s}:${String(raw)}`).digest('hex');
    return { salt: s, hash: h };
}
function validateImageContentType(ct) {
    if (!ct)
        return false;
    return /^image\/(png|jpe?g|webp|gif)$/i.test(ct);
}
/**
 * Fetches all puzzles' public data.
 */
exports.getPuzzles = functions.https.onCall(async (_data, _context) => {
    try {
        const snapshot = await db.collection("puzzles")
            .where("isPublished", "==", true)
            .get();
        const puzzles = snapshot.docs.map((doc) => {
            const puzzleData = doc.data();
            const isSolved = Boolean(puzzleData === null || puzzleData === void 0 ? void 0 : puzzleData.isSolved);
            const publicData = Object.assign({}, puzzleData);
            // 민감 정보는 항상 제거
            delete publicData.recoveryPhrase;
            delete publicData.revealImageUrl;
            delete publicData.imagePath;
            delete publicData.revealImagePath;
            // 정답은 퍼즐이 해결된 경우에만 공개
            if (!isSolved) {
                delete publicData.answer;
            }
            return publicData;
        });
        // Sort by id ascending without requiring Firestore composite index
        puzzles.sort((a, b) => Number(a.id) - Number(b.id));
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
        const query = await db.collection("puzzles").where("id", "==", puzzleId).limit(1).get();
        if (query.empty) {
            throw new functions.https.HttpsError("not-found", "Puzzle not found.");
        }
        const doc = query.docs[0];
        const puzzle = doc.data();
        // Validate answer first
        const isCorrect = guess.trim().toLowerCase() === String(puzzle.answer).toLowerCase();
        if (!isCorrect) {
            // Increment global wrong attempts counter atomically
            try {
                await doc.ref.update({ wrongAttempts: admin.firestore.FieldValue.increment(1) });
            }
            catch (incErr) {
                functions.logger.warn('Failed to increment wrongAttempts', incErr);
            }
            // Use failed-precondition to avoid misleading 401 Unauthorized in network logs
            throw new functions.https.HttpsError("failed-precondition", "Incorrect answer. Please try again.");
        }
        // Atomically mark solved only once
        const firstSolver = await db.runTransaction(async (tx) => {
            const snap = await tx.get(doc.ref);
            const d = snap.data();
            if (!(d === null || d === void 0 ? void 0 : d.isSolved)) {
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
        const snapshot = await db.collection("puzzles").orderBy("id", "asc").get();
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
    var _a, _b, _c;
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
        }
        else if (rewardType === 'image') {
            if (!data.revealImageUrl) {
                throw new functions.https.HttpsError("invalid-argument", "Missing required field for image reward: revealImageUrl");
            }
        }
        else if (rewardType === 'text') {
            if (!data.revealText) {
                throw new functions.https.HttpsError("invalid-argument", "Missing required field for text reward: revealText");
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
            imageUrl: String(data.imageUrl),
            rewardAmount: String(data.rewardAmount),
            isSolved: Boolean((_a = data.isSolved) !== null && _a !== void 0 ? _a : false),
            isPublished: Boolean((_b = data.isPublished) !== null && _b !== void 0 ? _b : false),
            wrongAttempts: Number((_c = data.wrongAttempts) !== null && _c !== void 0 ? _c : 0),
            answer: String(data.answer),
            rewardType,
        };
        if (data.imagePath) {
            puzzleDoc.imagePath = String(data.imagePath);
        }
        if (rewardType === 'metamask') {
            puzzleDoc.walletaddress = String(data.walletaddress);
            puzzleDoc.explorerLink = String(data.explorerLink);
            puzzleDoc.recoveryPhrase = String(data.recoveryPhrase);
        }
        else if (rewardType === 'image') {
            puzzleDoc.revealImageUrl = String(data.revealImageUrl);
            if (data.revealImagePath) {
                puzzleDoc.revealImagePath = String(data.revealImagePath);
            }
            // Optional fields may be empty in this mode
            if (data.walletaddress)
                puzzleDoc.walletaddress = String(data.walletaddress);
            if (data.explorerLink)
                puzzleDoc.explorerLink = String(data.explorerLink);
        }
        else if (rewardType === 'text') {
            puzzleDoc.revealText = String(data.revealText);
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
        const doc = snapshot.docs[0];
        const puzzle = doc.data();
        // Try to delete associated Storage files
        const bucket = getDefaultBucket();
        const candidates = [
            extractStoragePath(puzzle.imagePath) || extractStoragePath(puzzle.imageUrl),
            extractStoragePath(puzzle.revealImagePath) || extractStoragePath(puzzle.revealImageUrl),
        ];
        for (const path of candidates) {
            if (!path)
                continue;
            try {
                await bucket.file(path).delete({ ignoreNotFound: true });
                functions.logger.info(`Deleted storage object: ${path}`);
            }
            catch (err) {
                functions.logger.warn(`Failed to delete storage object ${path}`, err);
            }
        }
        await doc.ref.delete();
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
 * Batch update multiple puzzles by id. Admin only.
 * @param {{updates: Array<Record<string, unknown>>}} data - Each item must include `id` and fields to update
 */
exports.updatePuzzlesBatchAdmin = functions.https.onCall(async (data, context) => {
    assertIsAdmin(context);
    try {
        const updates = (data === null || data === void 0 ? void 0 : data.updates) || [];
        if (!Array.isArray(updates) || updates.length === 0) {
            throw new functions.https.HttpsError("invalid-argument", "updates must be a non-empty array");
        }
        const batch = db.batch();
        for (const item of updates) {
            const id = item === null || item === void 0 ? void 0 : item.id;
            if (typeof id === 'undefined') {
                throw new functions.https.HttpsError("invalid-argument", "Each update must include id");
            }
            const snap = await db.collection("puzzles").where("id", "==", id).limit(1).get();
            if (snap.empty)
                continue;
            const ref = snap.docs[0].ref;
            const payload = {};
            for (const [k, v] of Object.entries(item)) {
                if (k === 'id')
                    continue;
                payload[k] = v;
            }
            if (Object.keys(payload).length > 0) {
                batch.update(ref, payload);
            }
        }
        await batch.commit();
        return { success: true };
    }
    catch (error) {
        functions.logger.error("Error in updatePuzzlesBatchAdmin:", error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError("internal", "Failed to batch update puzzles.");
    }
});
/**
 * Batch delete puzzles by ids. Admin only.
 * @param {{ids: number[]}} data
 */
exports.deletePuzzlesBatchAdmin = functions.https.onCall(async (data, context) => {
    assertIsAdmin(context);
    try {
        const ids = (data === null || data === void 0 ? void 0 : data.ids) || [];
        if (!Array.isArray(ids) || ids.length === 0) {
            throw new functions.https.HttpsError("invalid-argument", "ids must be a non-empty array");
        }
        const batch = db.batch();
        for (const id of ids) {
            const snap = await db.collection("puzzles").where("id", "==", id).limit(1).get();
            if (snap.empty)
                continue;
            batch.delete(snap.docs[0].ref);
        }
        await batch.commit();
        return { success: true };
    }
    catch (error) {
        functions.logger.error("Error in deletePuzzlesBatchAdmin:", error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError("internal", "Failed to batch delete puzzles.");
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
// grantAdminRole removed per product decision
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
/**
 * Board: Public image upload (no auth). Stores under board/ and returns public URL.
 */
exports.uploadBoardImage = functions.https.onCall(async (data, _context) => {
    try {
        const { base64, contentType } = data || {};
        if (!base64 || !contentType || !validateImageContentType(String(contentType))) {
            throw new functions.https.HttpsError('invalid-argument', 'Invalid image payload');
        }
        const bucket = getDefaultBucket();
        const now = new Date();
        const key = `board/${now.getFullYear()}/${now.getMonth() + 1}/${Date.now()}_${Math.random().toString(36).slice(2)}.img`;
        const buffer = Buffer.from(String(base64), 'base64');
        await bucket.file(key).save(buffer, { contentType: String(contentType), resumable: false, public: true, metadata: { cacheControl: 'public, max-age=31536000' } });
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${encodeURIComponent(key)}`;
        return { success: true, url: publicUrl, path: key };
    }
    catch (error) {
        functions.logger.error('uploadBoardImage error', error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', 'Failed to upload');
    }
});
/**
 * Board: Create post with password protection.
 */
exports.addBoardPost = functions.https.onCall(async (data, _context) => {
    try {
        const { title, content, password, imageUrls } = data || {};
        const t = String(title || '').trim();
        const c = String(content || '').trim();
        const p = String(password || '').trim();
        if (!t || !c || !p)
            throw new functions.https.HttpsError('invalid-argument', 'title, content, password are required');
        if (t.length > 80)
            throw new functions.https.HttpsError('invalid-argument', 'title too long');
        if (c.length > 5000)
            throw new functions.https.HttpsError('invalid-argument', 'content too long');
        const images = Array.isArray(imageUrls) ? imageUrls.map((u) => String(u)).slice(0, 6) : [];
        const { salt, hash } = hashPassword(p);
        const payload = {
            title: t,
            content: c,
            imageUrls: images,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            passwordSalt: salt,
            passwordHash: hash,
        };
        const ref = await db.collection('boardPosts').add(payload);
        return { success: true, id: ref.id };
    }
    catch (error) {
        functions.logger.error('addBoardPost error', error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', 'Failed to add post');
    }
});
/** Fetch posts (public). */
exports.getBoardPosts = functions.https.onCall(async (data, _context) => {
    try {
        const { limit = 30, id } = data || {};
        if (id) {
            const snap = await db.collection('boardPosts').doc(String(id)).get();
            if (!snap.exists)
                throw new functions.https.HttpsError('not-found', 'Post not found');
            const d = snap.data();
            delete d.passwordHash;
            delete d.passwordSalt;
            return Object.assign({ id: snap.id }, d);
        }
        const snap = await db.collection('boardPosts').orderBy('createdAt', 'desc').limit(Number(limit)).get();
        const items = snap.docs.map((doc) => {
            const d = doc.data();
            delete d.passwordHash;
            delete d.passwordSalt;
            return Object.assign({ id: doc.id }, d);
        });
        return items;
    }
    catch (error) {
        functions.logger.error('getBoardPosts error', error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', 'Failed to fetch posts');
    }
});
/** Update post with password verification. */
exports.updateBoardPost = functions.https.onCall(async (data, _context) => {
    try {
        const { id, password, title, content, imageUrls } = data || {};
        if (!id || !password)
            throw new functions.https.HttpsError('invalid-argument', 'id and password required');
        const ref = db.collection('boardPosts').doc(String(id));
        const snap = await ref.get();
        if (!snap.exists)
            throw new functions.https.HttpsError('not-found', 'Post not found');
        const d = snap.data();
        const { hash } = hashPassword(String(password), d.passwordSalt);
        if (hash !== d.passwordHash)
            throw new functions.https.HttpsError('permission-denied', 'Invalid password');
        const update = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
        if (typeof title !== 'undefined')
            update.title = String(title).slice(0, 80);
        if (typeof content !== 'undefined')
            update.content = String(content).slice(0, 5000);
        if (Array.isArray(imageUrls))
            update.imageUrls = imageUrls.map((u) => String(u)).slice(0, 6);
        await ref.update(update);
        return { success: true };
    }
    catch (error) {
        functions.logger.error('updateBoardPost error', error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', 'Failed to update post');
    }
});
/** Delete post with password verification; try deleting images. */
exports.deleteBoardPost = functions.https.onCall(async (data, _context) => {
    try {
        const { id, password } = data || {};
        if (!id || !password)
            throw new functions.https.HttpsError('invalid-argument', 'id and password required');
        const ref = db.collection('boardPosts').doc(String(id));
        const snap = await ref.get();
        if (!snap.exists)
            throw new functions.https.HttpsError('not-found', 'Post not found');
        const d = snap.data();
        const { hash } = hashPassword(String(password), d.passwordSalt);
        if (hash !== d.passwordHash)
            throw new functions.https.HttpsError('permission-denied', 'Invalid password');
        // delete images if in our bucket
        try {
            const bucket = getDefaultBucket();
            const imgs = Array.isArray(d.imageUrls) ? d.imageUrls : [];
            for (const u of imgs) {
                const path = extractStoragePath(String(u));
                if (path)
                    await bucket.file(path).delete({ ignoreNotFound: true });
            }
        }
        catch (err) {
            functions.logger.warn('Failed to delete board images', err);
        }
        await ref.delete();
        return { success: true };
    }
    catch (error) {
        functions.logger.error('deleteBoardPost error', error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', 'Failed to delete post');
    }
});
/**
 * Returns the answer for a puzzle only if it has already been solved.
 * This allows clients to display the correct answer on solved cards
 * even if the initial listing omitted the answer field.
 */
exports.getSolvedAnswer = functions.https.onCall(async (data, _context) => {
    var _a;
    try {
        const { puzzleId } = data || {};
        if (typeof puzzleId === 'undefined') {
            throw new functions.https.HttpsError('invalid-argument', 'puzzleId is required');
        }
        const snapshot = await db.collection('puzzles').where('id', '==', puzzleId).limit(1).get();
        if (snapshot.empty) {
            throw new functions.https.HttpsError('not-found', 'Puzzle not found');
        }
        const puzzle = snapshot.docs[0].data();
        if (!(puzzle === null || puzzle === void 0 ? void 0 : puzzle.isSolved)) {
            throw new functions.https.HttpsError('permission-denied', 'Answer is only available after the puzzle is solved');
        }
        return { answer: String((_a = puzzle.answer) !== null && _a !== void 0 ? _a : '') };
    }
    catch (error) {
        functions.logger.error('Error in getSolvedAnswer:', error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', 'Failed to get answer');
    }
});
/**
 * Sets or updates the solver's display name for a puzzle.
 * This is optional and can be moderated by admins.
 */
exports.setSolverName = functions.https.onCall(async (data, _context) => {
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
    }
    catch (error) {
        functions.logger.error('Error in setSolverName:', error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', 'Failed to set solver name');
    }
});
//# sourceMappingURL=index.js.map