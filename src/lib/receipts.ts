export type SavedReceipt = {
  token: string;
  name: string;
  projectTitle: string;
  roleTitle: string;
  submittedAt: string;
};

const KEY = 'casting_receipts';

export function loadReceipts(): SavedReceipt[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveReceipt(receipt: SavedReceipt) {
  const rest = loadReceipts().filter((item) => item.token !== receipt.token);
  localStorage.setItem(KEY, JSON.stringify([receipt, ...rest].slice(0, 20)));
}
