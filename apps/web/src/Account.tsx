import { useState } from "react";
import { getIdToken, signOut } from "./auth.ts";

// The Account screen: sign out, or erase everything (GDPR) after an explicit confirmation.
export function Account() {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string>();

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
    <div className="flex flex-col gap-4 p-5">
      <h2 className="font-display text-3xl font-black">Account</h2>
      <button type="button" className="chunk-btn bg-card text-ink" onClick={() => void signOut()}>
        Sign out
      </button>
      {!confirming ? (
        <button type="button" className="chunk-btn bg-card text-ink" onClick={() => setConfirming(true)}>
          Delete my account
        </button>
      ) : (
        <div role="alertdialog" aria-labelledby="delete-title" className="chunk flex flex-col gap-3 p-4">
          <h3 id="delete-title" className="font-display text-xl font-black">
            Delete your account?
          </h3>
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
            className="chunk-btn bg-accent text-white"
            onClick={() => void deleteAccount()}
            disabled={deleting}
          >
            {deleting ? "Deleting…" : "Yes, delete everything"}
          </button>
          <button type="button" className="chunk-btn bg-card text-ink" onClick={() => setConfirming(false)} disabled={deleting}>
            Cancel
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
