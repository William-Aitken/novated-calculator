# novated-calculator
Novated quote checker

## Local development environment variables

Create a `.env.local` file in the project root (do not commit it). You can copy the included example:

```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3-flash
```

The server API route at `src/app/api/extract/route.ts` reads `process.env.GEMINI_API_KEY` and uses `GEMINI_MODEL` (defaults to `gemini-3-flash`).

After creating `.env.local`, restart the dev server: `npm run dev`.
