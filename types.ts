// Represents the full puzzle data, including sensitive information.
// This should only exist on the server-side (e.g., in a Firebase Cloud Function).
export interface PrivatePuzzle {
  id: number;
  level: number;
  imageUrl: string;
  walletaddress: string;
  rewardAmount: string;
  explorerLink: string;
  isSolved?: boolean;
  isPublished?: boolean;
  wrongAttempts?: number;
  solverName?: string;
  answer: string;
  recoveryPhrase: string;
  // Reward handling
  rewardType: 'metamask' | 'image';
  // Only for non-metamask rewards: URL to reveal after solving
  revealImageUrl?: string;
}

// Represents the puzzle data that is safe to send to the client.
// It excludes the answer and recovery phrase.
// Public data excludes any sensitive fields
export type PublicPuzzle = Omit<PrivatePuzzle, 'answer' | 'recoveryPhrase' | 'revealImageUrl'> & {
  // 퍼즐이 해결된 경우에 한해 서버가 정답을 포함해서 내려줄 수 있음
  answer?: string;
};
