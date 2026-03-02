# Chat Modules Setup

1. Apply database migration:
   - `npm run db:deploy`
   - or `npm run db:migrate` in local dev.

2. Regenerate Prisma client:
   - `npm run db:generate`
   - If Windows file lock blocks engine rename:
     - Stop running Node dev processes first.
     - Then run `npm run db:generate` again.
   - Do not use `--no-engine` for this project, otherwise API routes can fail with `P6001` and return HTTP 500.

3. Optional upload limits (bytes):
   - `CHAT_MAX_IMAGE_SIZE_BYTES` (default `8388608`)
   - `CHAT_MAX_VIDEO_SIZE_BYTES` (default `36700160`)

4. Start app:
   - `npm run dev`

The chat UI is available at `/{locale}/chat` and now includes:
- Support Chat (Customer <-> Admin)
- Center Chat (Admin + selected employees)
- Real-time event stream, unread indicators, pagination, soft delete, file uploads.
