"use client";

import {
  Horizon,
  Keypair,
  TransactionBuilder,
  Networks,
  Operation,
  Asset,
  Memo,
  BASE_FEE,
} from "@stellar/stellar-sdk";

export const HORIZON_URL = "https://horizon-testnet.stellar.org";
export const FRIENDBOT_URL = "https://friendbot.stellar.org";
export const RESERVE_BUFFER = 1.5; // 1 XLM base reserve + small buffer
const TX_FEE = String(Number(BASE_FEE) * 2); // bump for reliability

const server = new Horizon.Server(HORIZON_URL);

export type Wallet = { publicKey: string; secret: string };

export function createKeypair(): Wallet {
  const kp = Keypair.random();
  return { publicKey: kp.publicKey(), secret: kp.secret() };
}

export function loadKeypair(secret: string) {
  return Keypair.fromSecret(secret);
}

export function isValidPublicKey(s: string): boolean {
  try {
    Keypair.fromPublicKey(s);
    return true;
  } catch {
    return false;
  }
}

export async function fundWithFriendbot(publicKey: string): Promise<boolean> {
  try {
    const res = await fetch(`${FRIENDBOT_URL}?addr=${encodeURIComponent(publicKey)}`);
    return res.ok;
  } catch {
    return false;
  }
}

export async function getXlmBalance(publicKey: string): Promise<number> {
  try {
    const acc = await server.loadAccount(publicKey);
    const native = acc.balances.find((b: any) => b.asset_type === "native");
    return native ? Number(native.balance) : 0;
  } catch {
    return 0;
  }
}

// per-account serial submission queue — only one TX in flight per source at a time
const queues = new Map<string, Promise<unknown>>();
function enqueue<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = queues.get(key) ?? Promise.resolve();
  const next = prev.catch(() => undefined).then(fn);
  queues.set(
    key,
    next.catch(() => undefined),
  );
  return next;
}

function clampMemo(s: string): string {
  // Stellar TEXT memo is max 28 bytes UTF-8
  const enc = new TextEncoder();
  let out = s;
  while (enc.encode(out).length > 28 && out.length > 0) out = out.slice(0, -1);
  return out;
}

export type SettleArgs = {
  sourceSecret: string;
  destination: string;
  amount: number; // in XLM
  memo: string;
};

export type SettleResult = {
  ok: boolean;
  hash?: string;
  error?: string;
};

/**
 * Submit a settlement payment. Serialized per source so we never collide on seqnum.
 * Caller should await this for confirmation, but UI can update optimistically beforehand.
 */
export async function submitPayment(args: SettleArgs): Promise<SettleResult> {
  const { sourceSecret, destination, amount, memo } = args;
  if (!(amount > 0)) return { ok: false, error: "amount must be > 0" };
  const kp = loadKeypair(sourceSecret);

  return enqueue(kp.publicKey(), async () => {
    try {
      const acc = await server.loadAccount(kp.publicKey());
      const native = acc.balances.find((b: any) => b.asset_type === "native");
      const balance = native ? Number(native.balance) : 0;
      const maxSpendable = balance - RESERVE_BUFFER;
      if (maxSpendable <= 0) return { ok: false, error: "below reserve" };
      const send = Math.min(amount, maxSpendable);

      const tx = new TransactionBuilder(acc, {
        fee: TX_FEE,
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          Operation.payment({
            destination,
            asset: Asset.native(),
            amount: send.toFixed(7),
          }),
        )
        .addMemo(Memo.text(clampMemo(memo)))
        .setTimeout(30)
        .build();
      tx.sign(kp);
      const res = await server.submitTransaction(tx);
      const hash = (res as any)?.hash ?? (res as any)?.id;
      return { ok: true, hash };
    } catch (e: any) {
      const msg =
        e?.response?.data?.extras?.result_codes
          ? JSON.stringify(e.response.data.extras.result_codes)
          : String(e?.message ?? e);
      return { ok: false, error: msg };
    }
  });
}

/**
 * Drain a source to destination. Sends balance - RESERVE_BUFFER.
 * Used by withdraw.
 */
export async function drainTo(sourceSecret: string, destination: string): Promise<SettleResult> {
  const kp = loadKeypair(sourceSecret);
  return enqueue(kp.publicKey(), async () => {
    try {
      const acc = await server.loadAccount(kp.publicKey());
      const native = acc.balances.find((b: any) => b.asset_type === "native");
      const balance = native ? Number(native.balance) : 0;
      const amount = balance - RESERVE_BUFFER;
      if (amount <= 0) return { ok: false, error: "below reserve" };
      const tx = new TransactionBuilder(acc, {
        fee: TX_FEE,
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          Operation.payment({
            destination,
            asset: Asset.native(),
            amount: amount.toFixed(7),
          }),
        )
        .setTimeout(30)
        .build();
      tx.sign(kp);
      const res = await server.submitTransaction(tx);
      return { ok: true, hash: (res as any).hash };
    } catch (e: any) {
      return { ok: false, error: String(e?.message ?? e) };
    }
  });
}
