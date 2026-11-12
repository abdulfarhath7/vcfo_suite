# Landing page screenshots

The ten product screenshots on the landing page (`public/landing/*.webp`) are taken from a local
copy of the app whose demo data has been made anonymous. No screenshot may show a real client,
person, address or identifier. The SBC logo in the app's top bar stays; the sidebar never shows.

## Retaking them

1. Start a **local** database and load the demo data (`npm run infra:up`, `npm run db:migrate`,
   `npm run db:seed`, `npm run db:seed-demo`). The migrations need the `pgvector` extension.
2. Make the data anonymous. The script refuses any database that is not on localhost.

   ```bash
   DATABASE_URL=postgresql://vcfo:vcfo_local_dev@localhost:5432/vcfo node scripts/landing-screenshots/sanitize.mjs
   ```

   It rewrites every text and JSON column: company names become "Your Company" (the client the
   landing follows) and "Company B" onwards; staff become "Lead A", "Manager A", "Admin A" and
   "Partner"; client contacts become "Contact 1" onwards; directors become "Director" plus a letter;
   addresses, PAN, CIN, LLPIN, DIN, phone numbers and short references become sample values.
3. Run the app (`npm run dev`, with `node scripts/cp-css.mjs` first for the client portal CSS), then
   capture:

   ```bash
   node scripts/landing-screenshots/capture.cjs http://localhost:3000 /tmp/landing-shots
   ```

   Each shot is taken at twice the pixel density. The window is widened by the sidebar's width and
   the sidebar is cropped off, so the top bar and logo stay. The two calendars are cropped to the
   month grid alone, and the Ask VCFO shot is the chat panel alone.
4. Look at every image for a name, address or number that should not be there before you use it.
   Convert each PNG to WebP (quality 88) into `public/landing/`, and set the matching `width`,
   `height` and alt text in `src/components/marketing/landing/LandingScreen.tsx`.

New demo data with new names needs a line in `sanitize.mjs` before the next capture.
