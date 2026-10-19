# Sign in with Google only

Learners sign in only with Google, through Cognito federation and Cognito's managed login page. Sign-up is open, and every Session spends real money on a paid voice API, so the main threat is mass account creation to farm free Daily allowances. Google sign-in hands that identity proofing to Google, which already does bot detection and phone verification, and accounts there are costly to create in bulk. It also removes a whole layer we would otherwise build: verification emails (Cognito's built-in sender is capped at about 50 emails per day, so we'd need SES out of sandbox), Turnstile on a custom sign-up form, a pre-sign-up Lambda and a throwaway-email blocklist.

## Consequences

- People without a Google account can't sign up. We accept this for the MVP.
- Adding email sign-in later brings back all of the defences listed above.
