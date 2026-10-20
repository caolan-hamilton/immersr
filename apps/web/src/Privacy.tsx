// The Privacy screen: what Immersr stores, in plain English. Every point here was checked against the code
// (see the pull request for #57); change the wording whenever the code changes.
interface PrivacyProps {
  onBack(): void;
  /** Where "back" goes, for the button label: Account when signed in, the start screen when signed out. */
  backLabel: string;
}

const section = "flex flex-col gap-2";
const list = "flex list-disc flex-col gap-1.5 pl-5";

export function Privacy({ onBack, backLabel }: PrivacyProps) {
  return (
    <div className="flex grow flex-col gap-5 p-5 desk:mx-auto desk:w-full desk:max-w-[680px] desk:grow-0 desk:gap-6 desk:px-8 desk:pb-12 desk:pt-8">
      <button type="button" className="chunk-btn bg-card text-ink desk:self-start desk:px-9" onClick={onBack}>
        ← Back to {backLabel}
      </button>
      <h1 className="font-display text-3xl font-black desk:text-[40px]">Privacy: what Immersr stores</h1>
      <p className="muted">A short, plain-English summary of what the app does today. It isn't a formal privacy policy.</p>

      <section className={section}>
        <h2 className="font-display text-xl font-black">Signing in</h2>
        <ul className={list}>
          <li>You sign in with Google, through Amazon Cognito.</li>
          <li>Cognito keeps your Google account ID and your email address.</li>
          <li>Immersr never sees your Google password.</li>
        </ul>
      </section>

      <section className={section}>
        <h2 className="font-display text-xl font-black">What Immersr stores</h2>
        <p>It's kept in Amazon DynamoDB in Ireland (eu-west-1), under your Learner ID:</p>
        <ul className={list}>
          <li>
            Each Session: its Target language, Level, Topic, start and end times, your local calendar day, the minutes
            charged and the Immersion time (how long the Partner spoke).
          </li>
          <li>Your Immersion time totals for each language, and your Streak.</li>
          <li>
            Daily usage counters (your Daily allowance and your Turn translations), which delete themselves about a
            week later.
          </li>
        </ul>
        <p>Immersr also keeps one app-wide counter of Session minutes per day. It isn't linked to you.</p>
        <p>
          On your own device, the app remembers your sign-in, your language, Level and Listening mode choices, and a
          Session whose end hasn't reached the server yet.
        </p>
      </section>

      <section className={section}>
        <h2 className="font-display text-xl font-black">What Immersr does not store</h2>
        <ul className={list}>
          <li>Session audio.</li>
          <li>The Transcript. It exists only in your browser while the Session runs.</li>
        </ul>
      </section>

      <section className={section}>
        <h2 className="font-display text-xl font-black">What goes to other services</h2>
        <ul className={list}>
          <li>
            <b>OpenAI:</b> your Session audio, the Partner's instructions (which include your Target language, Level and
            Topic) and the Topic itself. OpenAI checks the Topic with its moderation service first. Immersr uses
            OpenAI's standard API, which may process data outside the EU, under OpenAI's own retention terms.
          </li>
          <li>
            <b>Amazon Translate</b> (Ireland, eu-west-1): the text of a Partner Turn, only when you tap it for a Turn
            translation. Immersr doesn't store it.
          </li>
        </ul>
      </section>

      <section className={section}>
        <h2 className="font-display text-xl font-black">Deleting everything</h2>
        <ul className={list}>
          <li>"Delete my account" on the Account screen removes your Immersr data and your sign-in.</li>
          <li>If a Session is in progress, it's ended first. Its minutes still count towards the app-wide daily total.</li>
          <li>
            Your own usage counters are deleted too, so your Daily allowance for today may start fresh if you sign in
            again.
          </li>
        </ul>
      </section>

      <section className={section}>
        <h2 className="font-display text-xl font-black">Contact</h2>
        <p>Questions: contact the owner</p>
      </section>
    </div>
  );
}
