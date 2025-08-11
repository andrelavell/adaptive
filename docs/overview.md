# Adaptive.ai — Closed-Loop Creative Engine

## Summary
Adaptive.ai automates high-performing Meta ads by learning from real performance, generating on-brand variants, and publishing with policy preflight. It closes the loop daily: ingest insights, analyze winners, generate/crop/validate images across ratios, publish as drafts or live, then retrain a similarity–novelty policy per account.

## Key Capabilities
- Ingest ad- and asset-level insights (Dynamic Creative breakdowns when available).
- Attribute conversions via Conversions API (CAPI), not pixel-only.
- Multimodal analysis of winning creatives (vision + copy) to extract structured features.
- Embeddings for copy and images; cluster into “angles.”
- Similarity vs. novelty dial governs how close new variants are to top clusters.
- Render images in required ratios: 1:1, 4:5, 16:9, 9:16.
- Preflight validation using Meta Ads execution_options=validate_only (+ include_recommendations).
- Auto-fix common issues (e.g., text density) and re-validate before publish.
- Publish to selected campaigns/ad sets, as drafts or live.
- Contextual bandit balances explore/exploit per account and objective.

## System Architecture
- Orchestrator (Responses API + tools): schedules the daily loop and calls internal tools/services.
- Meta Integration Service: insights pull, image upload, creative/ad creation, validation, CAPI events.
- Analysis Service (OpenAI multimodal): extracts structured features and compliance notes from creative.
- Similarity Service (Embeddings): encodes copy/images; clusters and computes centroids.
- Generator (OpenAI image + copy): produces prompts, short copy, and renders across ratios.
- Validator/Guardrails: brand/policy checks, text density, safe-zone cropping, placement suitability.
- Bandit Learner: UCB/Thompson over creative clusters optimizing CTR/purchases/ROAS with decay.
- Storage: creatives, assets, embeddings, performance, clusters, configs, jobs, validations.
- Web UI (existing `web/`): controls lookback window, similarity dial, daily cap, publish mode, objective, placements.

Data flow (daily loop):
1) Pull insights for lookback window → normalize KPIs (impr-weighted CTR, purchases, ROAS).
2) Join with CAPI purchases for reliable reward signals.
3) If DC available, compute asset-level winners; else use ad-level.
4) Analyze representative winners (vision+copy) → JSON features + compliance notes.
5) Embed copy and images → cluster into angles; compute top cluster(s) and centroids.
6) Sample directions per similarity dial; draft prompts and short copy.
7) Render required aspect ratios; safe-crop if needed.
8) Upload as AdImages → create AdCreatives → Ads with validate_only.
9) If recommendations/flags → auto-adjust and re-validate.
10) Publish as drafts or live per user setting. Update store with results.

## External APIs
- Meta Marketing API (Graph):
  - GET /act_{ad_account_id}/insights with breakdowns: title_asset, body_asset, image_asset, call_to_action_asset
  - POST /{ad_account_id}/adimages (multipart) → returns image_hash
  - POST /{ad_account_id}/adcreatives (object_story_spec or creative specs)
  - POST /{ad_account_id}/ads (execution_options: ["validate_only","include_recommendations"]) 
  - POST /{pixel_id}/events (Conversions API)
- OpenAI Platform:
  - Responses API for tool-calling/orchestration
  - Multimodal (vision) for structured analysis
  - Embeddings for text and images
  - Images generation for 1:1, 4:5, 16:9, 9:16

## Config & Secrets (env)
- META_ACCESS_TOKEN, META_APP_ID, META_APP_SECRET
- META_AD_ACCOUNT_ID, META_PIXEL_ID, META_PAGE_ID
- OPENAI_API_KEY
- APP_BASE_URL, WEBHOOK_SIGNING_SECRET
- DB_URL (Postgres recommended, with pgvector) or managed vector DB
- STORAGE_BUCKET (if persisting renders)

## Storage Model (logical)
- Account, Campaign, AdSet, Ad, Creative, Asset (image/headline/body/CTA), Placement
- PerformanceMetrics { impressions, ctr, actions, action_values, spend, purchases, roas, window }
- Embedding { id, type: image|text, vector, ref_id }
- Cluster { id, centroid_vector, members[], angle_summary }
- GenerationJob { id, inputs, similarity, outputs, status }
- ValidationResult { id, flags[], recommendations[] }
- BanditPolicy { account_id, objective, params, posterior_state }
- Config { lookback_days/date_range, daily_cap, similarity, publish_mode, placements[] }

## Guardrails
- Always preflight with validate_only + include_recommendations.
- Multimodal brand/policy checker before publish.
- Safe-zone templates per aspect ratio to avoid cropping faces/headlines.
- Enforce placement-aware min sizes and aspect hints; re-render or crop safely.
- CAPI-first attribution to reduce bias and improve optimization.

## Operational Considerations
- Scheduling: daily or intra-day via cron/queue; backoff on rate limits.
- Error handling: idempotent uploads/creates; store validate_only responses.
- Observability: per-step metrics, structured logs, failure alerts.
- Privacy: hash PII for CAPI; follow Meta policies and regional data laws.

## Deployment Notes
- Backend workers for ingestion/generation/validation/publish.
- Web UI in `web/` for controls and review.
- Staging vs production ad accounts; feature flags for risky ops.

## Roadmap (high-level)
- MVP: ingestion + analysis + render + validate-only drafts.
- V1: publishing + bandit loop + policy autofix.
- V2: per-placement rendering strategies + auto-aspect framing.
- V3: creative brief importer; asset library dedup + retrieval.
