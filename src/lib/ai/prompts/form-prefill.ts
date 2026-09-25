/**
 * Form Prefill Prompt Templates
 *
 * AI prompts for generating (intent `fill`) and revising (intent `refine`)
 * form field values from natural language.
 *
 * The two intents need genuinely different prompts: filling means "extract
 * what is stated and leave everything else alone", refining means "the user is
 * asking you to change something that is already there". Sharing one prompt is
 * why refinement used to be a no-op.
 */

import { USER_OVERRIDABLE_FIELDS, type AiAssistIntent } from '@/config/ai-form-assist';
import { logger } from '@/utils/logger';

/**
 * Rules for anything the AI *writes* as prose, as opposed to *extracts* as fact.
 *
 * This block exists because "only output what you can confidently extract"
 * produces descriptions like "I offer photography." for a service titled
 * Photography — technically faithful, useless to a buyer. Facts must not be
 * invented; sentences must still be written.
 */
const WRITING_QUALITY_RULES = `WRITING QUALITY (this is where output usually fails — read carefully):
- Facts and prose are different things. NEVER invent a FACT: prices, dates, locations, stock levels, delivery times, credentials, guarantees, contact details. If a fact is not in the user's text, leave that field out.
- But DO write real prose for free-text fields. A description is written copy, not an echo of the title.
- Bad: title "Photography", description "I offer photography." That is a failure. Write at least 3 full sentences a stranger would find useful: what this is, who it is for, and what to expect.
- Never restate the title as the first sentence of the description.
- Write plainly and specifically. No hype words ("amazing", "revolutionary", "world-class"), no exclamation marks, no emoji, and never leave filler or placeholder text in a field.
- Write in the same language the user wrote in.`;

const BITCOIN_RULES = `BITCOIN AND MONEY:
- OrangeCat settles payments in Bitcoin/Lightning; fiat currencies are for pricing and display only
- Express Bitcoin amounts in BTC (e.g., 0.001 BTC) EVERYWHERE — in prices and in any title/description text. NEVER write "sats" or "satoshis"; rephrase to BTC even if the user's description used sats.
- Keep fiat prices in the currency the user mentioned — do not convert
- A field whose name ends in _btc holds Bitcoin ONLY. If the user gave the amount in fiat ("1800 a month", "200 francs"), LEAVE THAT FIELD OUT — do not convert it. You have no exchange rate, so any number you write there is invented, and it is a number someone will be charged. Put the figure in the fiat price field if one exists, otherwise mention it in the description and leave the amount for the user to enter.
- Price examples: "0.001 BTC", "CHF 50", "$25", "€100"`;

const OUTPUT_FORMAT = `OUTPUT FORMAT:
{
  "data": {
    "field_name": "value",
    ...
  },
  "confidence": {
    "field_name": 0.95,
    ...
  }
}`;

/**
 * System prompt for form prefill / refinement.
 *
 * `formName` is the resolved human name of whatever form is being filled — an
 * entity ("Service") or a standalone form ("Task", "Proposal").
 */
export function getSystemPrompt(formName: string, intent: AiAssistIntent = 'fill'): string {
  const task =
    intent === 'refine'
      ? `The user already has a filled-in ${formName} form and is asking you to CHANGE it. Apply the change they describe and return the updated values.

REVISION RULES:
1. The instruction describes a change to make. Make it — never return the current values unchanged.
2. Return a field ONLY if its value should change. Omit every field that stays the same.
3. Return complete replacement values, never diffs, fragments or instructions.
4. Change only what the instruction implies. Do not quietly rewrite unrelated fields.
5. Never shorten, truncate or downgrade a field you were not asked to change.`
      : `Extract structured data from the user's natural language description to help them create a ${formName}.

RULES:
1. Only include fields you can confidently derive from the description
2. Do not make up factual information that is not in the description
3. For unclear values, omit them rather than guess
4. Always return every field marked required that is a name or text — for a title, write a short, specific one from the description. (Rule 1 once left a draft product with no title, and a draft without its required title cannot be saved.)`;

  return `You are the form-filling assistant for OrangeCat, an AI-powered platform for economic activity.

${task}

ALWAYS:
- Output valid JSON only — no markdown, no explanations
- Include a "confidence" object with a score (0-1) for every field you return

${WRITING_QUALITY_RULES}

${BITCOIN_RULES}

${OUTPUT_FORMAT}`;
}

/** Drop empty/absent values so prompts only carry real content. */
function nonEmptyEntries(data?: Record<string, unknown>): Record<string, unknown> {
  if (!data) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== '' && v !== null && v !== undefined)
  );
}

/**
 * Build the user prompt with field definitions and the user's request
 */
export function getUserPrompt(
  formName: string,
  userDescription: string,
  fieldsDescription: string,
  specialInstructions: string,
  existingData?: Record<string, unknown>,
  intent: AiAssistIntent = 'fill'
): string {
  const currentValues = nonEmptyEntries(existingData);
  const special = specialInstructions ? `\nSpecial instructions:\n${specialInstructions}\n` : '';

  if (intent === 'refine') {
    return `I am editing my ${formName}.

CURRENT FORM VALUES:
${JSON.stringify(currentValues, null, 2)}

THE CHANGE I WANT:
"${userDescription}"

Available fields for this ${formName}:
${fieldsDescription}
${special}
Apply my change to the current values. Output ONLY valid JSON with "data" and "confidence" objects, containing only the fields whose values should change.`;
  }

  let prompt = `I want to create a ${formName}.

Here's my description:
"${userDescription}"

Available fields for this ${formName}:
${fieldsDescription}
${special}`;

  if (Object.keys(currentValues).length > 0) {
    // Price and currency are always overridable — if the user mentions them in their description,
    // the AI should pick them up rather than keeping template defaults.
    const preserved = Object.fromEntries(
      Object.entries(currentValues).filter(([k]) => !USER_OVERRIDABLE_FIELDS.includes(k))
    );
    if (Object.keys(preserved).length > 0) {
      prompt += `\nPreserve these existing values (do not overwrite):
${JSON.stringify(preserved, null, 2)}\n`;
    }
  }

  prompt += `
Extract the relevant field values from my description. Output ONLY valid JSON with "data" and "confidence" objects.`;

  return prompt;
}

/**
 * Parse the AI response and extract data with confidence scores
 */
export function parseAIResponse(
  response: string
): { data: Record<string, unknown>; confidence: Record<string, number> } | null {
  try {
    // Try to extract JSON from the response
    // Sometimes AI might wrap it in markdown code blocks
    let jsonStr = response.trim();

    // Remove markdown code blocks if present
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7);
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3);
    }
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(0, -3);
    }
    jsonStr = jsonStr.trim();

    const parsed = JSON.parse(jsonStr);

    // Validate structure
    if (!parsed.data || typeof parsed.data !== 'object') {
      logger.error('AI response missing "data" object', undefined, 'AI');
      return null;
    }

    // Ensure confidence object exists
    const confidence = parsed.confidence || {};

    // Add default confidence for fields without explicit confidence
    for (const key of Object.keys(parsed.data)) {
      if (!(key in confidence)) {
        confidence[key] = 0.7; // Default confidence
      }
    }

    // Coerce numeric fields — LLMs sometimes return numbers as strings.
    // No fields end in _sats anymore (BTC is canonical per CLAUDE.md);
    // pattern dropped in 2026-06-05 SATS sweep.
    const numericFieldPatterns = [
      /_btc$/,
      /_usd$/,
      /^price/,
      /^amount/,
      /^rate/,
      /^hourly_rate$/,
      /^fixed_price$/,
      /^duration/,
      /^inventory/,
      /^count/,
      /^quantity/,
      /^target_amount/,
      /^minimum_investment/,
      /^funding_goal/,
    ];
    const coercedData: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(parsed.data)) {
      if (typeof val === 'string' && numericFieldPatterns.some(p => p.test(key))) {
        const num = Number(val);
        coercedData[key] = isNaN(num) ? val : num;
      } else {
        coercedData[key] = val;
      }
    }

    return {
      data: coercedData,
      confidence,
    };
  } catch (error) {
    logger.error('Failed to parse AI response', error, 'AI');
    return null;
  }
}
