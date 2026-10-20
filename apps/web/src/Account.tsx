import { useState } from "react";
import { getEmail, getIdToken, signOut } from "./auth.ts";

// The Account screen: sign out, or erase everything (GDPR) after an explicit confirmation.
export function Account() {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string>();
  const email = getEmail();

  async function deleteAccount() {
    setDeleting(true);
    setError(undefined);
    try {
      const token = await getIdToken();
      if (!token) throw new Error("You're signed out. Sign in again to delete your account.");
      const response = await fetch("/api/me", { method: "DELETE", headers: { authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error(`Something went wrong (${response.status}). Please try again.`);
      await signOut();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setDeleting(false);
    }
  }

  return (
    <div className="flex grow flex-col gap-3.5 p-5">
      <h1 className="font-display text-3xl font-black">Account</h1>
      <div className="chunk px-4 py-3.5">
        <div className="font-bold">Signed in with Google</div>
        {email && <div className="muted break-all">{email}</div>}
      </div>
      {/* The privacy content itself is #12; this anchor is where it will live. */}
      <a href="#privacy" className="inline-flex min-h-11 items-center font-bold text-ink underline">
        Privacy: what Immersr stores
      </a>
      <button type="button" className="chunk-btn bg-card text-ink" onClick={() => void signOut()}>
        Sign out
      </button>
      {!confirming ? (
        <button
          type="button"
          className="min-h-11 cursor-pointer self-start p-0 font-bold text-bad underline"
          onClick={() => setConfirming(true)}
        >
          Delete my account
        </button>
      ) : (
        <div role="alertdialog" aria-labelledby="delete-title" className="chunk flex flex-col gap-3 p-4">
          <h2 id="delete-title" className="font-display text-xl font-black">
            Delete your account?
          </h2>
          <p>
            This permanently removes your account, your Immersion time in every language, your Session history and your
            usage records. It can't be undone. If a Session is in progress, it ends first.
          </p>
          <p className="muted">
            Session audio is processed by OpenAI while you talk; we don't store Transcripts, so there is nothing of that
            to delete here.
          </p>
          <button
            type="button"
            className="chunk-btn bg-bad text-on-bad"
            onClick={() => void deleteAccount()}
            disabled={deleting}
          >
            {deleting ? "Deleting…" : "Delete for good"}
          </button>
          <button type="button" className="chunk-btn bg-card text-ink" onClick={() => setConfirming(false)} disabled={deleting}>
            Keep my account
          </button>
          {error && (
            <p role="alert">
              <span className="dot bad" /> {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
