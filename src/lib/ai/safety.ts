import type { SafetyCategory } from "../types";

export type SafetyHit = {
  category: SafetyCategory;
  reason: string;
};

export type SafetyResult = {
  blocked: boolean;
  hits: SafetyHit[];
};

// ---------------------------------------------------------------------------
// Tiny helpers
// ---------------------------------------------------------------------------

function any(text: string, ...needles: (string | RegExp)[]): boolean {
  return needles.some((n) =>
    typeof n === "string" ? text.includes(n) : n.test(text)
  );
}

function emojiCount(text: string): number {
  // Approximate. Counts most pictographic codepoints.
  const matches = text.match(/[\p{Extended_Pictographic}]/gu);
  return matches ? matches.length : 0;
}

// ---------------------------------------------------------------------------
// Category detectors — POST level (runs before drafting)
// ---------------------------------------------------------------------------

function detectCrisis(t: string): SafetyHit | null {
  // Strong, unambiguous phrases. Better to over-flag and let a reviewer
  // override than to miss someone in a crisis.
  if (
    any(
      t,
      "kill myself",
      "want to die",
      "wanna die",
      "don't want to wake up",
      "dont want to wake up",
      "wasn't here tomorrow",
      "wasnt here tomorrow",
      "won't be here tomorrow",
      "wont be here tomorrow",
      "no point anymore",
      "nothing to live for",
      "end it all",
      "i'm done",
      "im done",
      /\bsuicid(e|al)\b/i,
      /\bself[\s-]?harm\b/i,
      /\bcutting myself\b/i
    )
  ) {
    return {
      category: "crisis",
      reason: "Post contains language consistent with active crisis or self-harm.",
    };
  }
  // Relapse language in a mental-health context.
  if (/\brelapsed\b/i.test(t) && /(clean|sober|months|years)/i.test(t)) {
    return {
      category: "crisis",
      reason: "Post describes a relapse — emotionally acute moment, do not engage.",
    };
  }
  return null;
}

function detectMinor(t: string): SafetyHit | null {
  // "my 14 year old", "my 15-year-old daughter", "she's 13", "i'm 14"
  const ageMatch = t.match(
    /\b(?:my|her|his|their|she'?s|he'?s|i'?m)\s+(\d{1,2})[\s-]?(?:year|yr|yo|y\/o)/i
  );
  if (ageMatch) {
    const age = parseInt(ageMatch[1], 10);
    if (age < 18) {
      return {
        category: "minor",
        reason: `Post references a minor (age ${age}).`,
      };
    }
  }
  // Parent talking about an unspecified-age child in a vulnerable context.
  if (
    /\bmy (daughter|son|kid|child|teen|teenager)\b/i.test(t) &&
    /(crying|won't tell me|wont tell me|hurting|struggling|shut out|anxious|depressed)/i.test(t)
  ) {
    return {
      category: "minor",
      reason: "Post is about a parent's minor child in a vulnerable context.",
    };
  }
  return null;
}

function detectMedicalAndCure(t: string): SafetyHit[] {
  const hits: SafetyHit[] = [];
  if (
    any(
      t,
      /\bcure[ds]?\b/i,
      /\bcuring\b/i,
      "literally cures",
      "this stuff cures",
      "fully cured",
      "no more meds",
      "off my meds"
    )
  ) {
    hits.push({
      category: "diagnosis_cure_prevention",
      reason: "Post makes a cure/treatment claim for a mental-health condition.",
    });
    hits.push({
      category: "medical_claim",
      reason: "Post promotes an unverified medical/supplement claim.",
    });
  }
  return hits;
}

function detectPrivacy(t: string, raw: string): SafetyHit | null {
  // US phone-number shape: (555) 123-4567 or 555-123-4567 or 5551234567
  const phone = /\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/.test(raw);
  // Prescription / medical record exposure
  const rx = /\b(prescription|sertraline|fluoxetine|escitalopram|adderall|rx|mg daily)\b/i.test(t);
  const street = /\b\d+\s+\w+\s+(street|st|avenue|ave|blvd|road|rd|drive|dr)\b/i.test(t);

  if (phone && (rx || street)) {
    return {
      category: "privacy",
      reason: "Post exposes private contact info alongside medical/location details.",
    };
  }
  if (phone) {
    return { category: "privacy", reason: "Post contains a phone number." };
  }
  if (rx && /\b(photo|picture|pic|here'?s)\b/i.test(t)) {
    return {
      category: "privacy",
      reason: "Post shares a photo of medical/prescription information.",
    };
  }
  return null;
}

function detectInappropriateIntervention(t: string): SafetyHit | null {
  if (
    any(
      t,
      "not looking for advice",
      "don't want advice",
      "dont want advice",
      "no advice please",
      "please no 'have you tried'"
    )
  ) {
    return {
      category: "inappropriate_intervention",
      reason: "Author has explicitly said they don't want advice or engagement.",
    };
  }
  if (
    any(
      t,
      /\bburied my\b/i,
      /\bpassed away\b/i,
      /\bfuneral\b/i,
      "lost my husband",
      "lost my wife",
      "lost my child",
      "lost my mother",
      "lost my father"
    )
  ) {
    return {
      category: "inappropriate_intervention",
      reason: "Post is about acute bereavement.",
    };
  }
  return null;
}

function detectSpammyPost(t: string): SafetyHit | null {
  // The POST is itself promotional / manipulative (e.g. selling a supplement).
  if (
    /\bcode [A-Z]{3,}\b/.test(t) ||
    any(t, /\d{1,3}%\s*off\b/i, "link in bio", "use code", "promo code", "discount code")
  ) {
    return {
      category: "spam_manipulative",
      reason: "Post contains promotional / affiliate marketing language.",
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Top-level checks
// ---------------------------------------------------------------------------

/**
 * Run all rule-based detectors against a post BODY. Used before drafting —
 * if anything trips, we skip drafting and surface the block in the UI.
 */
export function checkPostSafety(body: string): SafetyResult {
  const lower = body.toLowerCase();
  const hits: SafetyHit[] = [];

  const crisis = detectCrisis(lower);
  if (crisis) hits.push(crisis);

  const minor = detectMinor(lower);
  if (minor) hits.push(minor);

  hits.push(...detectMedicalAndCure(lower));

  const privacy = detectPrivacy(lower, body);
  if (privacy) hits.push(privacy);

  const intervention = detectInappropriateIntervention(lower);
  if (intervention) hits.push(intervention);

  const spam = detectSpammyPost(lower);
  if (spam) hits.push(spam);

  // De-duplicate by category — keep first reason for each.
  const seen = new Set<SafetyCategory>();
  const deduped = hits.filter((h) => {
    if (seen.has(h.category)) return false;
    seen.add(h.category);
    return true;
  });

  return { blocked: deduped.length > 0, hits: deduped };
}

// ---------------------------------------------------------------------------
// Draft-level checks (used in Step 7 — after drafting)
// ---------------------------------------------------------------------------

/**
 * Run rule-based detectors against the GENERATED comment. Catches drafts
 * that drift into spammy shape, claim language, or Sonia-mention without
 * disclosure.
 */
export function checkDraftSafety(
  comment: string,
  opts: { mentionsSonia: boolean }
): SafetyResult {
  const hits: SafetyHit[] = [];
  const lower = comment.toLowerCase();

  if (any(lower, /\b(cure[ds]?|cures|diagnose[ds]?|diagnosis|treat[ed]?|prevent[ed]?)\b/i)) {
    hits.push({
      category: "diagnosis_cure_prevention",
      reason: "Draft uses clinical/cure language that we never claim.",
    });
  }

  if (/https?:\/\//i.test(comment)) {
    hits.push({
      category: "spam_manipulative",
      reason: "Draft contains a link — Sonia comments never include links.",
    });
  }

  if (emojiCount(comment) > 1) {
    hits.push({
      category: "spam_manipulative",
      reason: `Draft contains ${emojiCount(comment)} emojis — at most one is allowed.`,
    });
  }

  if ((comment.match(/!/g) ?? []).length > 1) {
    hits.push({
      category: "spam_manipulative",
      reason: "Draft uses multiple exclamation marks.",
    });
  }

  // Disclosure rule: if Sonia is mentioned, comment must START with disclosure.
  if (opts.mentionsSonia) {
    const startsDisclosed = /^\s*i\s+work\s+(on|at)\s+sonia/i.test(comment);
    if (!startsDisclosed) {
      hits.push({
        category: "spam_manipulative",
        reason: "Draft mentions Sonia without leading disclosure ('I work on Sonia — ').",
      });
    }
  }

  return { blocked: hits.length > 0, hits };
}
