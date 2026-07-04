Plan:

1. **Stop relying on external video URLs for demo playback**
   - Keep the MP4 source URLs only as seed inputs.
   - During `seed:demo`, download the small demo MP4s server-side and upload them into the app’s configured video storage bucket.

2. **Create real `Video` records for seeded video lessons**
   - For each seeded video lesson, create or replace a `READY` video row linked to the course and lesson.
   - Update the lesson content to `{ videoId, posterUrl: null }` instead of `{ externalUrl, posterUrl }`.
   - This makes seeded videos use the existing `/videos/:id/stream` presigned playback flow, the same as uploaded course videos.

3. **Make the seed idempotent**
   - Re-running `npm run seed:demo -- --reset` should rebuild lessons and their video objects cleanly.
   - Use deterministic object keys for demo videos so repeated seeding does not create unbounded duplicate files.

4. **Add a safer fallback in the player**
   - Keep external URL rendering supported for manually-added links.
   - Add basic video load error feedback so future URL failures show a useful message instead of a silent black player.

5. **Validation steps after implementation**
   - Run the API build to catch TypeScript issues.
   - Re-run the demo seed with reset.
   - Open a seeded video lesson and confirm the player requests `/videos/:id/stream` and plays from internal storage.