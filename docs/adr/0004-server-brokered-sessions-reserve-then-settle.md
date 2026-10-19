# Server-brokered Sessions with reserve-then-settle metering

The browser never holds an OpenAI credential. Starting a Session works like this:

1. The browser posts its WebRTC SDP offer and `{language, level, topic}` to our API.
2. A Lambda checks the inputs and builds the Partner's instructions on the server.
3. In one conditional DynamoDB update, it **reserves** the maximum Session length against both the Learner's Daily allowance and the global daily cap.
4. It forwards the offer to OpenAI's `/v1/realtime/calls` with our API key and takes the `call_id` from the `Location` header.
5. It schedules a one-time EventBridge Scheduler job to call `/hangup` when the Session reaches its maximum length.

Ending a Session goes through our API. The server hangs up first, then **settles** by refunding the unused reservation using its own clock. So a client can't claim an early end and keep talking. If the tab is abandoned, the scheduled hang-up fires and the full reservation is charged.

We chose this because OpenAI offers no way to lock a session's config, no session length limit below 60 minutes, and no webhooks for WebRTC calls. The server therefore has to own the call ID and the clock.

## Considered Options

- **Browser-direct with an ephemeral client secret.** The server never learns the call ID, so it can't hang up or meter minutes. A script could hold a 60-minute Session on each token.
- **Server-brokered start plus a sideband monitor Lambda.** A Lambda would hold `wss://…/realtime?call_id=` for the whole Session, giving exact usage and the ability to re-apply instructions. Deferred: it's the planned next step, and the foundation for live drift detection.

## Consequences

- The browser can still rewrite the Partner's instructions over the data channel. That misuse is limited to the Learner's own reserved minutes, so it costs the same as normal use. We accept this.
- The maximum Session length must stay below Lambda's 15-minute limit if the sideband monitor is added later.
- Neither AWS Budgets nor our own code is the final cost ceiling. The OpenAI project runs on prepaid credits with auto-recharge off.
