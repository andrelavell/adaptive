# Adaptive.ai Action Plan

## Milestones
- M0: Project bootstrap, env, docs (this file, overview).
- M1: Meta OAuth + permissions (ads_read, ads_management) and tokens.
- M2: Conversions API (server-side) with purchase/value signals wired.
- M3: Insights ingestion with configurable lookback and DC asset breakdowns.
- M4: Storage schema (creatives, assets, metrics, embeddings, clusters, configs, jobs, validations).
- M5: Multimodal analysis (vision+copy) → structured JSON + compliance notes.
- M6: Embeddings + clustering; angle summaries; top-cluster selection.
- M7: Similarity dial logic (0..1) sampling near/far candidates.
- M8: Prompt/copy drafting; image generation across 1:1, 4:5, 16:9, 9:16.
- M9: Safe-zone cropping and placement constraints.
- M10: Meta upload (AdImages), AdCreatives, Ads with validate_only + recommendations.
- M11: Autofix loop for flagged issues; re-validate.
- M12: Publish modes (drafts/new campaign/existing ad set) with toggles.
- M13: Contextual bandit (UCB/Thompson), decay, and objective selection.
- M14: Web UI controls in `web/` for config and review.
- M15: Observability, alerts, and QA.

## Deliverables & Acceptance Criteria
- OAuth flow works; tokens stored securely; permissions verified.
- CAPI events arrive with matching quality; purchases/values reflected in Insights.
- Insights endpoint pulls with/without DC breakdowns; data normalized and stored.
- Analysis returns deterministic JSON fields + embeddings for copy and image.
- Clustering produces stable angles; similarity dial yields expected candidate diversity.
- Generation renders all ratios; safe-zone cropping never occludes faces/headlines.
- Validate-only returns recommendations captured; autofix reduces flags; final publish succeeds.
- Bandit policy improves RPME/ROAS over baseline after 2 weeks.
- UI exposes all controls and shows validation/publish statuses.

## Detailed Steps
1) Setup & SDKs
- Install Meta Business SDK (Graph) and OpenAI SDK.
- Define env vars and secret management.
- Create base service modules under `services/meta/`, `services/openai/`.

2) OAuth & Tokens (M1)
- Implement login + long-lived token exchange; store securely.
- Verify `ads_read`, `ads_management` scopes.

3) Conversions API (M2)
- Implement server-side Purchase events with value/currency.
- Hash and send user_data; dedupe IDs; log match quality.

4) Insights Ingestion (M3)
- GET `/act_{id}/insights?level=ad&fields=impressions,ctr,actions,action_values,spend,ad_name,ad_id,creative`.
- Add `breakdowns=title_asset,body_asset,image_asset,call_to_action_asset` when DC active.
- Support `time_range` and `date_preset`; normalize CTR (impr-weighted), purchases, ROAS.

5) Storage (M4)
- Define tables/collections for entities listed in overview.
- Add pgvector (or managed vector DB) for embeddings.

6) Analysis & Embeddings (M5–M6)
- Multimodal call to extract: subject, scene, composition, colors, people/demos, emotion, props, text-on-image, hook category, angle summary, compliance notes.
- Create text+image embeddings; store vectors.

7) Clustering & Dial (M6–M7)
- KMeans/HDBSCAN or cosine-threshold clusters; compute centroids.
- Map slider to max cosine distance from top centroid; low similarity → sample neighbor clusters.

8) Generation (M8–M9)
- Draft prompts + short copy variants per angle.
- Generate images for all ratios; fallback: re-run with aspect hints or safe-crop.

9) Meta Build & Preflight (M10–M11)
- Upload images → image_hashes; create AdCreatives with text + CTA.
- Create Ads with `execution_options=["validate_only","include_recommendations"]`.
- Parse flags/recommendations; auto-adjust (e.g., reduce text density), re-validate.

10) Publish Modes (M12)
- Support: drafts only, new campaign, existing campaign, existing ad set.
- Toggle status PAUSED/ACTIVE per user setting.

11) Learning Loop (M13)
- Reward: conversions or revenue per mille; decayed over time.
- Policy: Thompson or UCB over clusters; log priors/posteriors.

12) UI Controls (M14)
- Controls: lookback, daily cap, similarity, publish mode, objective, placements.
- Views: winners, recommendations, validations, drafts/published variants.

13) Ops & QA (M15)
- Metrics: latency per step, validation pass rate, CTR lift, RPME/ROAS delta.
- Alerts on API failures, validation blocks, publish errors.
- Staging with sandbox ad account; e2e and rollback plan.

## Risks & Mitigations
- Policy rejections → preflight+autofix, conservative templates.
- Weak attribution → CAPI + pixel matching, event dedupe, LDU compliance.
- Fatigue drift → time-decay in reward, sliding lookback.
- Overfitting to one angle → exploration via dial + bandit.

## Next Up
- Confirm env/secrets, then implement M1–M3.
