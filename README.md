
# Crypto Puzzle Quest

A web service where users solve image-based puzzles to earn rewards in the form of Metamask wallet recovery keys. Test your skills, solve the puzzles, and claim your crypto!

This application is built with a modern frontend stack and a secure, serverless backend using Firebase.

![Crypto Puzzle Quest Screenshot](https://storage.googleapis.com/framer-screenshots/2-1-1721245366432.png)

## Features

- **Dynamic Puzzles**: Fetches a list of puzzles from a secure backend.
- **Interactive Solving**: Users can submit answers for each puzzle.
- **Secure Validation**: Answers are validated on the server-side; client-side code never sees the correct answer.
- **Reward Reveal**: On solving a puzzle, a modal securely displays the 12-word wallet recovery phrase.
- **Clipboard Functionality**: Easily copy the recovery phrase.
- **Block Explorer Integration**: Each puzzle includes a link to verify the wallet's contents on a block explorer.
- **Responsive Design**: A clean, mobile-first interface built with Tailwind CSS.
- **Clear User Feedback**: Displays loading spinners and handles API errors gracefully.

---

## How to Get This App Working: Step-by-Step Guide
### App Check for Storage (Fix CORS preflight on uploads)
If Firebase App Check is enforced on Storage, initialize App Check on the client.

1. In Firebase Console, enable reCAPTCHA v3 provider and get a site key
2. Create `.env.local` in the project root and add:
   ```
   VITE_RECAPTCHA_V3_SITE_KEY=your_site_key
   ```
3. Restart dev server. The app initializes App Check automatically (dev uses a debug token).


To run this application, you must set up your own Firebase backend. Follow these steps carefully.

### Prerequisites
- You have a Google Account.
- You have Node.js and npm (or a similar package manager) installed.

### Step 1: Create a Firebase Project
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Click **"Add project"** and give it a name (e.g., "my-crypto-puzzles").
3. Continue through the setup steps. Google Analytics is optional.
4. Once your project is created, you will be taken to the project dashboard.

### Step 2: Set Up Firestore Database
This is where your puzzle data will be stored securely.

1. From the sidebar in your Firebase project, go to **Build > Firestore Database**.
2. Click **"Create database"**.
3. Start in **Production mode**. This is important for security.
4. Choose a location for your database (e.g., `us-central1`).
5. Click **"Enable"**.

### Step 3: Add Puzzle Data to Firestore
1. In the Firestore UI, click **"+ Start collection"**.
2. Set the Collection ID to `puzzles`.
3. Click **"Next"** and then **"Auto-ID"** to create your first puzzle document.
4. Add the fields for your puzzle. The structure must match the following example:

| Field Name | Type | Example Value |
| --- | --- | --- |
| `id` | `number` | `1` |
| `level`| `number`| `1` |
| `imageUrl` | `string` | `https://your-image-url.com/puzzle1.jpg` |
| `walletAddress`| `string`| `0x123...abc`|
| `rewardAmountUSDT`|`number`| `10` |
| `explorerLink`|`string` | `https://etherscan.io/address/0x123...abc` |
| `answer`| `string`| `TheSecretAnswer`|
| `recoveryPhrase`|`string` | `word1 word2 ... word12`|

5. Click **"Save"**. Add more puzzle documents as needed.

### Step 4: Configure Firestore Security Rules
These rules are **critical**. They prevent users from directly reading the answers and recovery phrases from your database. All access must go through your secure Cloud Functions.

1. In the Firestore UI, go to the **"Rules"** tab.
2. Replace the default rules with the following code:
    ```
    rules_version = '2';
    service cloud.firestore {
      match /databases/{database}/documents {
        // Deny all direct client-side reads and writes to the puzzles collection.
        // This forces all interactions to go through your secure Cloud Functions.
        match /puzzles/{puzzleId} {
          allow read, write: if false;
        }
      }
    }
    ```
3. Click **"Publish"**.

### Step 5: Connect Your Web App to Firebase
This step links the frontend code to *your* Firebase project.

1. Go to your Firebase Project's **Project Overview** page.
2. At the top, click the Web icon (`</>`) to add a web app.
3. Give your app a nickname (e.g., "Crypto Puzzles Frontend") and click **"Register app"**.
4. Firebase will provide you with a `firebaseConfig` object. **Copy this entire object.**
5. In your local project code, open the `firebase.ts` file.
6. **Replace the existing `firebaseConfig` object with the one you just copied from the Firebase console.**

### Step 6: Set Up and Deploy the Backend Cloud Functions
This is the server-side code that securely validates answers.

1. **Install the Firebase CLI**: If you don't have it, open your terminal and run:
   ```bash
   npm install -g firebase-tools
   ```
2. **Login to Firebase**:
   ```bash
   firebase login
   ```
3. **Initialize Functions in your project**:
   - In the **root directory** of your local project, run:
     ```bash
     firebase init functions
     ```
   - Select **"Use an existing project"** and choose the Firebase project you created.
   - For language, select **TypeScript**.
   - Decline to install dependencies with npm when prompted.
4. **Add the Backend Code**:
   - The command above creates a `functions` folder.
   - Go to `functions/src/index.ts`. Delete all the placeholder code inside it.
   - Copy the entire backend code block provided below and paste it into `functions/src/index.ts`.
5. **Install Dependencies and Deploy**:
   - Navigate into the functions directory:
     ```bash
     cd functions
     ```
   - Install the necessary Node.js modules:
     ```bash
     npm install firebase-functions firebase-admin
     ```
   - Navigate back to the root directory:
     ```bash
     cd ..
     ```
   - Deploy only the functions to Firebase:
     ```bash
     firebase deploy --only functions
     ```
     
Deployment can take a few minutes. Once it's complete, your backend is live!

---

## Required Backend Code (`functions/src/index.ts`)

```typescript
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();

/**
 * Fetches all puzzles' public data.
 * This is a callable function, ensuring that only authenticated client SDKs can call it.
 * It strips sensitive data (answer, recoveryPhrase) before sending it to the client.
 */
export const getPuzzles = functions.https.onCall(async (data, context) => {
  try {
    const snapshot = await db.collection("puzzles").orderBy("level", "asc").get();
    const puzzles = snapshot.docs.map(doc => {
      const puzzleData = doc.data();
      // SECURITY: Never send sensitive fields to the client in the public listing.
      delete puzzleData.answer;
      delete puzzleData.recoveryPhrase;
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
 * This is a callable function.
 * @param {object} data - The object sent from the client, containing `puzzleId` and `guess`.
 * @returns {object} An object containing the `recoveryPhrase` if the answer is correct.
 * @throws {HttpsError} Throws an error if the guess is wrong or if the puzzle isn't found.
 */
export const checkAnswer = functions.https.onCall(async (data, context) => {
  const { puzzleId, guess } = data;

  // Validate input
  if (!puzzleId || typeof guess !== 'string') {
    throw new functions.https.HttpsError("invalid-argument", "The function must be called with 'puzzleId' and 'guess' arguments.");
  }
  
  try {
    const snapshot = await db.collection("puzzles").where("id", "==", puzzleId).limit(1).get();

    if (snapshot.empty) {
      throw new functions.https.HttpsError("not-found", "Puzzle not found.");
    }

    const puzzle = snapshot.docs[0].data();

    // Case-insensitive answer check
    if (guess.trim().toLowerCase() === puzzle.answer.toLowerCase()) {
      // SUCCESS: Return the secret recovery phrase.
      return { recoveryPhrase: puzzle.recoveryPhrase };
    } else {
      // FAIL: Throw an authentication error to indicate a wrong answer.
      throw new functions.https.HttpsError("unauthenticated", "Incorrect answer. Please try again.");
    }
  } catch (error) {
    // Re-throw known errors, log and wrap unknown errors.
     if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    functions.logger.error("Error checking answer:", error, {puzzleId});
    throw new functions.https.HttpsError("internal", "An internal error occurred.");
  }
});
```

---

## Security Warning

This is a conceptual application. Do not use real funds or sensitive information. The security of the wallets is fundamentally tied to the security of your Firebase project and the secrecy of the recovery phrases.
