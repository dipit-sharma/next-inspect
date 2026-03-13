# next-inspect Development TODO

## Phase 1: Product Scope and Architecture

- [ ] Define the core problem and target users: Next.js developers needing visibility into server-side axios calls.
- [ ] Freeze the MVP feature list:
  - [ ] Start interceptor service with one command.
  - [ ] Capture axios request/response metadata.
  - [ ] Stream events to a websocket.
  - [ ] Show events in a browser UI on port 8757.
  - [ ] Replay calls from the UI so they also appear in browser network tab.
- [ ] Decide architecture boundaries:
  - [ ] Runtime interceptor module.
  - [ ] Local socket/event transport.
  - [ ] Dashboard server + frontend UI.
  - [ ] Shared event schema/types.
- [ ] Output: architecture doc, event schema draft, MVP acceptance criteria.

## Phase 2: Project Foundation

- [ ] Set up package structure (source folders, build, lint, test, release config).
- [ ] Add TypeScript types and strict checks.
- [ ] Define config model (port, enable/disable, filtering, redact rules).
- [ ] Add logging and error-handling conventions.
- [ ] Output: buildable skeleton package with CI checks passing.

## Phase 3: Interceptor Engine

- [ ] Implement axios interception hooks (request start, response success, response error).
- [ ] Normalize payload into a stable schema:
  - [ ] Method, URL, headers, body summary, timing, status, error details.
- [ ] Add safety controls:
  - [ ] Payload size cap.
  - [ ] Header/body redaction.
  - [ ] Ignore rules for internal or noisy endpoints.
- [ ] Add unit tests for transformation and redaction logic.
- [ ] Output: tested interceptor core producing structured events.

## Phase 4: Local Transport Layer

- [ ] Implement websocket server/client channel for event streaming.
- [ ] Add reconnect/backpressure strategy and queueing for short disconnects.
- [ ] Add health endpoints and heartbeat.
- [ ] Add tests for disconnect/reconnect and event ordering.
- [ ] Output: reliable local event pipeline from interceptor to UI service.

## Phase 5: Dashboard and Replay UX

- [ ] Build web UI to list requests with filters and detail panel.
- [ ] Add request replay flow from UI:
  - [ ] User can trigger request.
  - [ ] Execution appears in browser network tab as intended.
  - [ ] Replay result linked back to captured event.
- [ ] Add visual states: loading, failure, empty, reconnecting.
- [ ] Output: usable inspection dashboard on port 8757.

## Phase 6: Next.js Integration and DX

- [ ] Provide integration APIs:
  - [ ] Quick start helper.
  - [ ] Manual setup for custom server/runtime cases.
- [ ] Support common Next.js scenarios (dev server, API routes, server actions as applicable).
- [ ] Add clear startup behavior for npm run intercept and conflict handling when port is occupied.
- [ ] Output: integration guide and example app that works end-to-end.

## Phase 7: Hardening and Performance

- [ ] Benchmark overhead under realistic traffic.
- [ ] Optimize serialization and memory usage.
- [ ] Validate behavior on Windows/macOS/Linux.
- [ ] Add graceful shutdown and crash recovery behavior.
- [ ] Output: performance report and stability fixes merged.

## Phase 8: Documentation and Release

- [ ] Write docs:
  - [ ] Install/setup.
  - [ ] Config options.
  - [ ] Security/redaction guidance.
  - [ ] Troubleshooting.
- [ ] Add versioning/changelog/release automation.
- [ ] Publish first beta, collect feedback, then GA.
- [ ] Output: published package with onboarding docs and release process.

## Phase 9: Post-Launch Roadmap

- [ ] Add advanced filters/search/export.
- [ ] Add support for non-axios adapters (fetch/node http) if needed.
- [ ] Add team features (session save/share) and plugin hooks.
- [ ] Output: prioritized backlog based on real user feedback.

## Suggested Execution Cadence

- [ ] Week 1: Phases 1-2
- [ ] Week 2: Phase 3
- [ ] Week 3: Phases 4-5
- [ ] Week 4: Phases 6-8 and beta release
