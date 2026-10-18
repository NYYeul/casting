'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Proposal } from '@/lib/accounts';

export default function ProposalActions({ proposal }: { proposal: Proposal }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <div className="pc-actions">
      <button
        className="button button-outline sm"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await fetch(`/api/proposals/${proposal.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'declined' }),
          });
          router.refresh();
        }}
      >
        거절
      </button>
      <Link
        className="button button-primary sm"
        href={`/apply/${proposal.roleSlug}?proposal=${proposal.id}`}
      >
        배역 보고 지원하기 →
      </Link>
    </div>
  );
}
