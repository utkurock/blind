"use client";

import { useState } from "react";
import { isValidPublicKey, type Wallet } from "@/lib/stellar";

type Props = {
  open: boolean;
  onClose: () => void;
  play: Wallet | null;
  bank: Wallet | null;
  playBalance: number;
  bankBalance: number;
  onCreate: () => Promise<void>;
  onWithdraw: (destination: string) => Promise<void>;
  onWipe: () => void;
};

type Phase = "idle" | "creating" | "withdrawing";

function AccountRow({
  label,
  wallet,
  balance,
  revealed,
}: {
  label: string;
  wallet: Wallet;
  balance: number;
  revealed: boolean;
}) {
  const [copied, setCopied] = useState<"pub" | "sec" | null>(null);
  const copy = async (val: string, kind: "pub" | "sec") => {
    try {
      await navigator.clipboard.writeText(val);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1200);
    } catch {}
  };
  return (
    <div className="rounded-md border border-line/70 bg-bg/40 p-3">
      <div className="flex items-center justify-between">
        <span className="tag">{label}</span>
        <a
          href={`https://stellar.expert/explorer/testnet/account/${wallet.publicKey}`}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-[10px] lowercase tracking-[0.18em] text-dim hover:text-ink"
        >
          explorer ↗
        </a>
      </div>
      <button
        type="button"
        onClick={() => copy(wallet.publicKey, "pub")}
        className="mt-1.5 w-full break-all text-left font-mono text-xs text-ink hover:opacity-70"
        title="copy public key"
      >
        {wallet.publicKey}
      </button>
      <div className="mt-1.5 flex items-center justify-between">
        <span className="font-mono text-[11px] text-dim">
          {balance.toFixed(4)} <span className="text-dim/60">xlm</span>
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-dim">
          {copied === "pub" ? "address copied" : copied === "sec" ? "secret copied" : ""}
        </span>
      </div>
      {revealed && (
        <button
          type="button"
          onClick={() => copy(wallet.secret, "sec")}
          className="mt-2 w-full break-all rounded-sm border border-short/40 bg-short/[0.06] px-2 py-1.5 text-left font-mono text-[11px] text-short hover:bg-short/10"
          title="copy secret key — handle with care"
        >
          {wallet.secret}
        </button>
      )}
    </div>
  );
}

export function WalletModal({
  open,
  onClose,
  play,
  bank,
  playBalance,
  bankBalance,
  onCreate,
  onWithdraw,
  onWipe,
}: Props) {
  const [dest, setDest] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [revealSecrets, setRevealSecrets] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);

  if (!open) return null;

  const hasWallet = !!play && !!bank;
  const destValid = dest.length > 0 && isValidPublicKey(dest);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 px-3 py-4 backdrop-blur sm:items-center sm:px-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="panel-soft max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl p-5 sm:p-6"
      >
        <div className="mb-4 flex items-center justify-between">
          <span className="tag">wallet</span>
          <button onClick={onClose} className="pill">close</button>
        </div>

        {!hasWallet ? (
          <>
            <h2 className="font-editorial text-2xl leading-[1.05] text-ink sm:text-3xl">
              two accounts.<br />
              one quiet ledger.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              <span className="text-ink">play</span> holds your game balance,{" "}
              <span className="text-ink">bank</span> is the counterparty. Every round, the
              drand outcome flows between them as a real testnet payment. Both are funded
              with 10,000 XLM via Friendbot. Keys never leave this device.
            </p>
            <button
              type="button"
              disabled={phase === "creating"}
              onClick={async () => {
                setPhase("creating");
                await onCreate();
                setPhase("idle");
              }}
              className="pill pill-long mt-5 w-full justify-center py-2.5"
            >
              {phase === "creating" ? "creating + funding…" : "create + fund both"}
            </button>
          </>
        ) : (
          <>
            <div className="space-y-3">
              <AccountRow label="play" wallet={play!} balance={playBalance} revealed={revealSecrets} />
              <AccountRow label="bank" wallet={bank!} balance={bankBalance} revealed={revealSecrets} />
            </div>

            <button
              type="button"
              onClick={() => setRevealSecrets((v) => !v)}
              className="pill mt-3 w-full justify-center"
            >
              {revealSecrets ? "hide secret keys" : "reveal secret keys"}
            </button>

            <button
              type="button"
              onClick={() => setShowWithdraw((v) => !v)}
              className="mt-2 w-full text-center font-mono text-[10px] lowercase tracking-[0.2em] text-dim hover:text-ink"
            >
              {showWithdraw ? "hide withdraw" : "withdraw"}
            </button>

            {showWithdraw && (
              <>
                <div className="h-divider mt-6" />

                <div className="mt-5">
                  <span className="tag">withdraw</span>
                  <p className="mt-2 text-[11px] text-muted">
                    all testnet XLM in play and bank is sent to the destination. no tx hash
                    shown here — it lands quietly.
                  </p>
                  <input
                    type="text"
                    placeholder="g... destination address"
                    value={dest}
                    onChange={(e) => setDest(e.target.value.trim())}
                    className="mt-3 w-full rounded-md border border-line bg-bg/40 px-3 py-2 font-mono text-xs text-ink outline-none focus:border-ink/60"
                  />
                  <button
                    type="button"
                    disabled={!destValid || phase === "withdrawing"}
                    onClick={async () => {
                      setPhase("withdrawing");
                      await onWithdraw(dest);
                      setPhase("idle");
                      setDest("");
                    }}
                    className="pill pill-short mt-3 w-full justify-center py-2.5"
                  >
                    {phase === "withdrawing" ? "sending…" : "send all"}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
