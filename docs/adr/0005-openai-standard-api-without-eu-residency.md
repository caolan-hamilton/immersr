# OpenAI standard API, not EU data residency, for the MVP

Everything we store lives in eu-west-1. But Session audio goes to OpenAI's standard API (`api.openai.com`), not `eu.api.openai.com`, so OpenAI processes it outside the EU under its standard retention terms. EU residency for the realtime models needs OpenAI's approval and a zero-data-retention-style agreement, and costs about 10% more. That doesn't make sense before the app has real users. We don't store Transcripts ourselves, and the privacy policy discloses this processing. We'll revisit this if the app grows.
