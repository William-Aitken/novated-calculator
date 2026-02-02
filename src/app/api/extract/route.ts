import { NextResponse } from 'next/server';

// Server route to accept an uploaded file and forward to Gemini (if configured).
// Environment variables used:
// - GEMINI_API_KEY : API key for Gemini/Google Generative Language
// - GEMINI_MODEL : model name to call (defaults to 'gemini-1.5' if set)

export async function POST(req: Request) {
  let prompt: string | null = null;
  try {
    const form = await req.formData();
    const file = form.get('file') as Blob | null;
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const arr = await file.arrayBuffer();
    // Robust base64 conversion: Buffer may be unavailable in some runtimes (Edge).
    const base64ArrayBuffer = (arrayBuffer: ArrayBuffer) => {
      const bytes = new Uint8Array(arrayBuffer);
      const chunkSize = 0x8000; // arbitrary chunk size
      let result = '';
      for (let i = 0; i < bytes.length; i += chunkSize) {
        result += String.fromCharCode.apply(null, Array.prototype.slice.call(bytes, i, i + chunkSize));
      }
      if (typeof btoa !== 'undefined') return btoa(result);
      // Node-safe fallback using Buffer when available
      if (typeof Buffer !== 'undefined') return Buffer.from(arrayBuffer).toString('base64');
      // final fallback: build base64 via URL API
      try {
        const blob = new Blob([arrayBuffer]);
        // Note: blob.arrayBuffer and FileReader may not be available in all runtimes
        // but this is a last-resort attempt.
        // Convert blob -> dataURL synchronously isn't available; throw to go to Buffer fallback.
      } catch (_) {
        // ignore
      }
      // As a final attempt, use Buffer.from if global Buffer exists
      if ((globalThis as any)?.Buffer) return (globalThis as any).Buffer.from(arrayBuffer).toString('base64');
      throw new Error('Unable to convert file to base64 in this runtime');
    };

    let b64: string;
    try {
      if (typeof Buffer !== 'undefined') {
        b64 = Buffer.from(arr).toString('base64');
      } else {
        b64 = base64ArrayBuffer(arr);
      }
    } catch (e) {
      console.error('Base64 conversion failed:', e);
      return NextResponse.json({ error: 'Server runtime does not support file base64 conversion', prompt }, { status: 500 });
    }
    const mime = (file as any).type || 'application/octet-stream';

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    let GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3-flash';
    // Normalize model resource name for Google Generative Language REST/SDK
    if (!GEMINI_MODEL.startsWith('models/')) {
      GEMINI_MODEL = `models/${GEMINI_MODEL}`;
    }

    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not configured on server' }, { status: 500 });
    }

    // Improved prompt instructing Gemini exactly what to extract and the JSON schema to return.
    // The model should return ONLY valid JSON (no explanatory text) following the schema below.
    prompt = `You will be given an image or PDF containing a novated lease / vehicle quote. Extract the following fields when they appear in the document:

- leaseTermYears: integer number of years (e.g. 3, 4, 5). Prefer whole years. It may be written as "36 months" etc — convert to years.
- fbtBaseValue: AUD amount (numeric) used as the FBT base value (no currency symbols in JSON).
- driveawayCost: AUD amount (numeric) for driveaway price.
- residualExcl: AUD residual value excluding GST (numeric).
- residualIncl: AUD residual value including GST (numeric).
- documentationFee: AUD amount (numeric).
- financedAmountManual: AUD financed amount (numeric). 
- paymentAmount: numeric payment per period (do NOT include frequency; e.g. 125.50). Also called "lease payment", "lease rental" or "vehicle finance payment" in some documents. if there are multiple values prefer the one in the runnings costs table, do not use  total lease payment.
- paymentsPerYear: integer payment frequency (use 52,26,12,1 where possible). If frequency is different for lease payment and runnings costs, prefer running cost frequency and convert lease payment.
- monthsDeferred: integer months deferred (e.g. 2).

Also extract the novated lease provider name when present:
- nlProvider: string name of the novated lease provider (e.g. 'Maxxia', 'SG Fleet').

Also extract the applicant's annual salary if present in the quote or accompanying paperwork:
- annualSalary: numeric annual salary (AUD) if the document includes income or salary information. This should be the "gross pay" or "pre-tax" annual salary figure.
              annualSalary: { type: 'number' },

Also optionally extract if present:
- isEv: boolean (true if the quote explicitly marks EV/electric vehicle or if the "post tax deduction" or "gst on post tax" under the summary of package/novated lease is 0) False if PHEV or ICE explicitly stated.
- runningCosts: object with optional numeric fields: managementFee, maintenance, tyres, rego, insurance, chargingFuel, other (AUD amounts).

Extraction rules:
- Convert any currency-like strings ("$12,345.00", "AUD 12,345") to plain numbers (12345).
- If only a residual percentage is present, do NOT attempt to invent a residual AUD unless the document provides values to compute it — prefer leaving the corresponding AUD field absent.
- For numbers presented with commas or currency symbols, parse them into numeric values without symbols.
- If a field is present but ambiguous, include the best candidate and set a confidence (0.0-1.0) nearer to 0 for ambiguous values.

Output schema (REQUIRED): return a single JSON object with these top-level keys only:
{
  "parsedFields": { /* map of extracted keys to numeric/string/boolean values (omit keys not found) */ },
  "confidences": { /* map of extracted keys to confidence between 0.0 and 1.0 */ },
  "rawText": "..." /* optional: short excerpt of the model's textual output or OCR text */, 
  "notes": "..." /* optional: brief notes about assumptions or parsing issues */
}

Important: Return strictly valid JSON with only the keys above (you may omit optional keys). Use numeric JSON types for amounts and integers, booleans for isEv, and omit currency symbols. Example valid output:
{
  "parsedFields": {
    "leaseTermYears": 5,
    "fbtBaseValue": 91387,
    "driveawayCost": 45000,
    "paymentsPerYear": 12
  },
  "confidences": {
    "leaseTermYears": 0.95,
    "fbtBaseValue": 0.92,
    "driveawayCost": 0.65,
    "paymentsPerYear": 0.9
  },
  "rawText": "{...}",
  "notes": "driveawayCost inferred from line 'Driveaway: $45,000'"
}

If you cannot find any of the requested fields, return a JSON object with an empty "parsedFields" map and optionally include a short "notes" entry explaining why.
`;

    // NOTE: The exact Gemini REST shape may vary depending on provider / version.
    // This implementation calls a commonly-used Google Generative Language REST endpoint.
    // If your environment requires a different endpoint shape (service account token, different url), update accordingly.

    const url = `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(GEMINI_MODEL)}:generate`;

    const body = {
      prompt: {
        text: prompt,
      },
      // provide image bytes as an attachment field where supported
      attachments: [
        {
          mime_type: mime,
          content: b64,
        },
      ],
      max_output_tokens: 1024,
    } as any;

    // Use single SDK approach: instantiate GoogleGenAI and call ai.models.generateContent
    let data: any = null;
    let rawRespText: string | null = null;
    let fullServiceResponse: any = null;
    try {
      const genaiModule = await import('@google/genai').catch(() => null);
      const genai: any = genaiModule as any;
      if (!genai || !genai.GoogleGenAI) {
        return NextResponse.json({ error: '@google/genai SDK not available on server; install @google/genai' }, { status: 500 });
      }

      const { GoogleGenAI } = genai;

      // DEBUG: show key prefix to ensure env is read (won't print whole key)
      console.log('Key starting with:', GEMINI_API_KEY?.substring(0, 5) + '...');

      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

      // Use literal JSON Schema type strings to avoid reliance on SDK export names
      const schema = {
        description: 'Novated lease extraction schema',
        type: 'object',
        properties: {
          parsedFields: {
            type: 'object',
            properties: {
              leaseTermYears: { type: 'number' },
              fbtBaseValue: { type: 'number' },
              driveawayCost: { type: 'number' },
              residualExcl: { type: 'number' },
              residualIncl: { type: 'number' },
              documentationFee: { type: 'number' },
              financedAmountManual: { type: 'number' },
              paymentAmount: { type: 'number' },
              paymentsPerYear: { type: 'number' },
              monthsDeferred: { type: 'number' },
              isEv: { type: 'boolean' },
              nlProvider: { type: 'string' },
              runningCosts: {
                type: 'object',
                properties: {
                  managementFee: { type: 'number' },
                  maintenance: { type: 'number' },
                  tyres: { type: 'number' },
                  rego: { type: 'number' },
                  insurance: { type: 'number' },
                  chargingFuel: { type: 'number' },
                  other: { type: 'number' },
                },
              },
            },
          },
          confidences: { type: 'object' },
          rawText: { type: 'string' },
          notes: { type: 'string' },
        },
      };

      const filePart = {
        inlineData: {
          data: b64,
          mimeType: mime,
        },
      };

      const request: any = {
        model: GEMINI_MODEL,
        contents: [
          {
            parts: [
              { text: prompt },
              filePart,
            ],
            role: 'user',
          },
        ],
        generationConfig: { maxOutputTokens: 1024 },
        responseConfig: {
          responseMimeType: 'application/json',
          responseSchema: schema,
        },
      };

      const triedModels: string[] = [];
      const tryGenerate = async (modelName: string) => {
        request.model = modelName;
        triedModels.push(modelName);
        return await ai.models.generateContent(request);
      };

      // Models to try if the primary model is rate-limited or unavailable.
      const FALLBACK_MODELS = [
        'models/gemini-2.5-flash',
        'models/gemini-2.5-flash-lite',
      ];

      let result: any = null;
      try {
        result = await tryGenerate(GEMINI_MODEL);
      } catch (e: any) {
        // Detect rate-limit / quota errors and retry with fallback models
        const msg = String(e?.message || e || '').toLowerCase();
        const isLimit = /quota|limit|exhausted|rate_limit|rate limit|429/.test(msg) || e?.status === 429 || e?.code === 429 || e?.statusCode === 429 || e?.response?.status === 429;
        if (isLimit) {
          console.warn('Primary model appears rate-limited; attempting fallback models', FALLBACK_MODELS);
          let lastErr: any = e;
          for (const fb of FALLBACK_MODELS) {
            try {
              result = await tryGenerate(fb);
              lastErr = null;
              break;
            } catch (e2: any) {
              lastErr = e2;
              console.warn('Fallback model failed:', fb, e2?.message ?? e2);
            }
          }
          if (lastErr) {
            fullServiceResponse = lastErr;
            throw lastErr;
          }
        } else {
          fullServiceResponse = e;
          throw e;
        }
      }
      fullServiceResponse = result;

      // Defensive normalization of SDK response shapes
      if (result?.response?.text) {
        try { data = JSON.parse(result.response.text); } catch (_) { data = result.response.text; }
      } else if (result?.outputText) {
        try { data = JSON.parse(result.outputText); } catch (_) { data = result.outputText; }
      } else if (result?.outputs && Array.isArray(result.outputs) && result.outputs[0]?.content) {
        const content = result.outputs[0].content;
        if (typeof content === 'string') {
          try { data = JSON.parse(content); } catch (_) { data = content; }
        } else if (content?.text) {
          try { data = JSON.parse(content.text); } catch (_) { data = content.text; }
        } else {
          data = content;
        }
      } else {
        data = result;
      }
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || String(e), serviceResponse: fullServiceResponse ?? null }, { status: 500 });
    }

    // (parsing was handled above for SDK or fetch paths)

    // Attempt to extract textual content from common response shapes
    let textOutput: string | null = null;
    if (data && typeof data === 'object') {
      // Google GenAI SDK may return `candidates[0].content.parts[...]` where each
      // part has a `text` field. Handle that shape first.
      if (data?.candidates && Array.isArray(data.candidates) && data.candidates[0]?.content) {
        const content = data.candidates[0].content;
        if (typeof content === 'string') {
          textOutput = content;
        } else if (content?.text) {
          textOutput = content.text;
        } else if (content?.parts && Array.isArray(content.parts)) {
          try {
            textOutput = content.parts.map((p: any) => p?.text ?? '').filter(Boolean).join('\n');
          } catch (_) {
            textOutput = JSON.stringify(content);
          }
        } else {
          textOutput = JSON.stringify(content);
        }
      } else if (data?.outputs && Array.isArray(data.outputs) && data.outputs[0]?.content) {
        const content = data.outputs[0].content;
        if (typeof content === 'string') textOutput = content;
        else if (content?.text) textOutput = content.text;
        else textOutput = JSON.stringify(content);
      } else if (data?.output && Array.isArray(data.output) && data.output[0]?.content) {
        const content = data.output[0].content;
        textOutput = typeof content === 'string' ? content : (content?.text ? content.text : JSON.stringify(content));
      } else if (data?.outputText) {
        textOutput = data.outputText;
      } else {
        try { textOutput = JSON.stringify(data); } catch (_) { textOutput = String(data); }
      }
    } else if (typeof data === 'string') {
      textOutput = data;
    } else if (rawRespText) {
      textOutput = rawRespText;
    }

    // Try to extract JSON blob from text output
    let parsedFields: any = null;
    try {
      if (!textOutput) {
        return NextResponse.json({ error: 'No textual output from model', parsedFields: null, rawText: rawRespText ?? null, serviceResponse: null, prompt }, { status: 500 });
      }
      // If textOutput contains JSON, parse it
      const match = textOutput.match(/\{[\s\S]*\}/);
      const jsonText = match ? match[0] : textOutput;
      parsedFields = JSON.parse(jsonText);
    } catch (e) {
      // Couldn't parse JSON - return raw text along with service response
      return NextResponse.json({ error: null, parsedFields: null, rawText: textOutput, serviceResponse: data, prompt });
    }

    return NextResponse.json({ error: null, parsedFields, rawText: textOutput, prompt, serviceResponse: data, fullServiceResponse });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err), prompt: prompt ?? null }, { status: 500 });
  }
}
