# MCP MIDI Bridge Development Plan

Goal: Harden the MCP API, add input validation, rate limiting and auth tokens for safe operation with external clients (e.g., Abacus AI), improve logging and robustness around the Python Magenta server, and provide a clear prioritized roadmap for further improvements.

Principles:
- Minimal invasive changes first — protect exposed API and ensure graceful failure modes.
- Config-driven behavior: keep auth and limits optional and configurable via AppConfig.
- Clear, machine-readable validation for NoteSequence inputs.
- Structured logging to allow aggregating logs and diagnosing issues.

Priority order (implementation order):
1. Add a JSON schema for NoteSequence and apply AJV validation to incoming MCP endpoints.
2. Add express-rate-limit middleware to throttle abusive clients and provide sane defaults.
3. Add token-based auth middleware (Authorization: Bearer <token>) configurable in AppConfig; required only if apiToken is present.
4. Add structured logging (pino) and replace ad-hoc console logs at critical points.
5. Harden python server spawn logic and provide clearer errors to the main process and UI.
6. Ensure graceful MIDI shutdown (send AllNotesOff) and make sure MIDI errors propagate to UI.
7. Add error boundaries in renderer and optional telemetry (Sentry) for crash reporting.
8. Add basic tests for validation and file operations (song-cache), and add CI to run lint/build/tests.

Files to add / modify (in this order):
- Add: src/schemas/note-sequence.schema.json — AJV schema for NoteSequence.
- Add: src/lib/logger.ts — small pino wrapper used across main process.
- Edit: package.json — add runtime dependencies (ajv, express-rate-limit, pino).
- Edit: src/types/index.ts — add optional apiToken to AppConfig to store the token used by external clients.
- Edit: src/main/main.ts — import and use the new middleware: AJV validation, token auth, rate-limiter; use logger for key messages; persist apiToken via existing saveConfig/loadConfig.
- Edit: src/common/python-server.ts — check script and executable paths, fallback to PATH python, add error handling for spawn failures and logs to the logger.

Implementation details / constraints:
- Validation: Use AJV to validate incoming NoteSequence on /song and /play endpoints. Reject payloads over a configurable note count limit (e.g., 20000 notes by default), with informative 400 responses.
- Rate limiting: Apply a rate limiter only to write endpoints (POST /song and POST /play) with default: 60 requests per minute per IP; make it configurable later.
- Auth: If config.apiToken is set (non-empty), require requests to present that token in Authorization header as Bearer token. If not set, requests are allowed without token for local/dev convenience.
- Logging: Minimal pino wrapper exposing info, warn, error. Keep console fallback for renderer-only logs.
- Config: AppConfig will include apiToken?: string; updates through the existing update-config IPC will persist it.

Testing & verification plan:
- Unit tests:
  - Validate good and bad NoteSequence payloads against schema.
  - SongCache read/write operations using a temp directory.
- Manual tests:
  - Start app and verify /health endpoint.
  - POST a valid NoteSequence to /song with and without Authorization header (when apiToken set) and verify responses and song cache.
  - POST /play and confirm midi-manager returns either success or a clear error when no MIDI device.
- Integration test: Optional script that mimics Abacus AI posting a NoteSequence and expecting a 200 OK.

Operational notes for future contributors:
- Keep the AJV schema in sync with src/types/index.ts Note and NoteSequence definitions.
- When adding new endpoints that accept NoteSequence, reuse the validation middleware.
- If the Python server is required in production, add packaging instructions for the python folder so the script and environment land in process.resourcesPath.

Roadmap (next milestones):
- Short term (1–3 days): Implement validation, rate-limiter, token auth, structured logging and python spawn hardening.
- Medium term (1–2 weeks): Add unit tests, CI (GitHub Actions), and React ErrorBoundary integration plus optional telemetry.
- Long term (months): Add e2e playback tests, mock the easymidi device for CI, add UI for token management and logs, and improve packaging for Python dependencies.

Contact points and decision log:
- Auth approach: token-in-config (simple shared secret) chosen because the app is typically local; for multi-tenant or internet-exposed deployments switch to OAuth or mTLS.
- Validation library: AJV selected for performance and schema compatibility. Alternative: zod (runtime-first) if prefer TypeScript-native approach.

End of plan.
