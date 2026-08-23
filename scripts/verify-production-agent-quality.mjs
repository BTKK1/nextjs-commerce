import { randomUUID } from "node:crypto";

const baseUrl = (process.env.PRODUCTION_AGENT_URL || "https://www.nbeh.io").replace(/\/$/, "");
const merchantKey = process.env.PRODUCTION_AGENT_MERCHANT_KEY || "a28ee8e8-4267-4514-bbf8-b277d07040d0";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function areNearDuplicates(leftValue, rightValue) {
  const left = normalize(leftValue);
  const right = normalize(rightValue);
  if (!left || !right) return false;
  if (left === right) return true;
  if (Math.min(left.length, right.length) < 24) return false;
  const leftWords = new Set(left.split(" ").filter((word) => word.length > 1));
  const rightWords = new Set(right.split(" ").filter((word) => word.length > 1));
  if (Math.min(leftWords.size, rightWords.size) < 5) return false;
  const shared = [...leftWords].filter((word) => rightWords.has(word)).length;
  const dice = (2 * shared) / (leftWords.size + rightWords.size);
  const containment = shared / Math.min(leftWords.size, rightWords.size);
  const lengthRatio = Math.min(left.length, right.length) / Math.max(left.length, right.length);
  return dice >= 0.82 || (containment >= 0.9 && lengthRatio >= 0.68);
}

function containsAny(value, patterns) {
  return patterns.some((pattern) => pattern.test(value));
}

async function requestJson(path, options) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }
  assert(response.ok, `${options?.method || "GET"} ${path} returned ${response.status}: ${text.slice(0, 240)}`);
  assert(payload, `${path} did not return JSON.`);
  return payload;
}

async function runJourney(journey) {
  const visitorRef = `anon-prodqa-${randomUUID().slice(0, 12)}`;
  const sessionId = randomUUID();
  let conversationId;
  const history = [];
  const answers = [];
  const fallbacks = [];

  for (const message of journey.messages) {
    const payload = await requestJson("/api/agent/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        merchantKey,
        productSlug: journey.productSlug,
        message,
        conversationId,
        visitorRef,
        sessionId,
        locale: journey.locale,
        conversationHistory: history.slice(-10),
        pageContext: {
          url: `${baseUrl}${journey.locale === "ar" ? "/ar" : ""}/store/product/${journey.productSlug}`,
          path: `${journey.locale === "ar" ? "/ar" : ""}/store/product/${journey.productSlug}`,
          title: journey.productName,
          productName: journey.productName,
          locale: journey.locale,
        },
      }),
    });

    assert(typeof payload.conversationId === "string" && payload.conversationId, `${journey.id}: conversation ID is missing.`);
    assert(typeof payload.answer === "string" && payload.answer.trim().length >= 8, `${journey.id}: answer is empty.`);
    assert(payload.answer.length <= 600, `${journey.id}: answer exceeded 600 characters.`);
    if (!journey.allowFallback) assert(!payload.fallbackReason, `${journey.id}: unexpected fallback ${payload.fallbackReason}.`);
    assert(!/^(hello|hi|welcome|أهلا|أهلًا|هلا)\b/i.test(payload.answer.trim()), `${journey.id}: repeated a canned greeting.`);

    conversationId = payload.conversationId;
    answers.push(payload.answer.trim());
    fallbacks.push(payload.fallbackReason || null);
    history.push({ role: "user", content: message }, { role: "assistant", content: payload.answer.trim() });
  }

  journey.verify(answers, fallbacks);
  for (let index = 1; index < answers.length; index += 1) {
    assert(!areNearDuplicates(answers[index - 1], answers[index]), `${journey.id}: consecutive answers are near-duplicates.`);
  }

  const query = new URLSearchParams({ conversationId, merchantKey, productSlug: journey.productSlug, visitorRef });
  const transcript = await requestJson(`/api/agent/chat?${query.toString()}`);
  const persistedUsers = (transcript.messages || []).filter((message) => message.role === "user");
  const persistedAnswers = (transcript.messages || []).filter((message) => message.role === "assistant" && !message.metadata?.welcome);
  assert(persistedUsers.length >= journey.messages.length, `${journey.id}: shopper turns were not durably persisted.`);
  assert(persistedAnswers.length >= journey.messages.length, `${journey.id}: assistant turns were not durably persisted.`);

  return {
    id: journey.id,
    product: journey.productSlug,
    turns: journey.messages.length,
    fallbackReasons: fallbacks.filter(Boolean),
    answerLengths: answers.map((answer) => answer.length),
    persisted: true,
  };
}

const journeys = [
  {
    id: "work-bag-fit",
    productSlug: "everyday-leather-tote",
    productName: "Everyday Leather Tote",
    locale: "en",
    messages: ["I carry a 13-inch laptop and commute to work. Is this a good work bag for me?"],
    verify: ([answer]) => {
      assert(containsAny(answer, [/14[- ]inch/i, /laptop/i]), "work-bag-fit: missed the verified laptop capacity.");
      assert(containsAny(answer, [/yes/i, /good fit/i, /suitable/i, /works? for/i]), "work-bag-fit: did not give a direct recommendation.");
    },
  },
  {
    id: "work-bag-known-mismatch",
    productSlug: "everyday-leather-tote",
    productName: "Everyday Leather Tote",
    locale: "en",
    messages: ["Will this fit my 15-inch laptop?"],
    verify: ([answer]) => {
      assert(/^\s*(no|it (?:will|does) not|it (?:won't|doesn't))/i.test(answer), "work-bag-known-mismatch: did not begin with an explicit rejection.");
      assert(/14[- ]inch/i.test(answer), "work-bag-known-mismatch: missed the verified 14-inch maximum.");
      assert(!containsAny(answer, [/yes/i, /good fit/i, /suitable/i, /works? for/i]), "work-bag-known-mismatch: implied a known mismatch was suitable.");
    },
  },
  {
    id: "price-objection",
    productSlug: "everyday-leather-tote",
    productName: "Everyday Leather Tote",
    locale: "en",
    messages: ["It feels expensive. Is it worth $320 for daily work? Give me one honest reason."],
    verify: ([answer]) => {
      assert(/\$\s?320|320\s?(USD|dollars?)/i.test(answer), "price-objection: exact USD price is missing.");
      assert(containsAny(answer, [/leather/i, /14[- ]inch/i, /suede/i, /brass/i]), "price-objection: value was not grounded in a catalog fact.");
    },
  },
  {
    id: "linen-tradeoff",
    productSlug: "pleated-linen-trouser",
    productName: "Pleated Linen Trouser",
    locale: "en",
    messages: ["I need trousers for hot summer weather, but I hate wrinkling. What is the honest trade-off?"],
    verify: ([answer]) => {
      assert(containsAny(answer, [/summer/i, /breath/i, /warm weather/i]), "linen-tradeoff: missed the summer benefit.");
      assert(containsAny(answer, [/crease/i, /wrinkl/i]), "linen-tradeoff: hid the linen creasing trade-off.");
    },
  },
  {
    id: "follow-up-memory",
    productSlug: "atelier-wool-coat",
    productName: "Atelier Wool Coat",
    locale: "en",
    messages: [
      "I want this for daily work and prefer the easiest color to wear.",
      "My chest is 39 inches. Which size and color would you choose for me?",
    ],
    verify: ([, answer]) => {
      assert(/\bM\b/.test(answer), "follow-up-memory: missed the verified 38–40 inch M size.");
      assert(/Charcoal/i.test(answer), "follow-up-memory: did not use the shopper's daily-work color priority.");
    },
  },
  {
    id: "missing-information",
    productSlug: "pleated-linen-trouser",
    productName: "Pleated Linen Trouser",
    locale: "en",
    allowFallback: true,
    messages: ["What is the exact inseam length in inches?"],
    verify: ([answer], fallbacks) => {
      assert(containsAny(answer, [
        /not (listed|available|clear|specified|provided|included)/i,
        /do not have/i,
        /don.t have/i,
        /doesn.t (list|specify|provide|include)/i,
        /isn.t (listed|specified|provided|included|available)/i,
        /unavailable/i,
      ]), "missing-information: did not state that inseam data is unavailable.");
      assert(!/\b(28|30|32|34|36)\s?(inch|inches|in\b)/i.test(answer), "missing-information: invented an inseam measurement.");
      assert(fallbacks[0] === "missing_catalog_field", "missing-information: missing-data telemetry was not recorded.");
    },
  },
  {
    id: "arabic-currency-fit",
    productSlug: "everyday-leather-tote",
    productName: "Everyday Leather Tote",
    locale: "ar",
    messages: ["كم سعره وهل يناسب لابتوب 13 إنش للدوام؟"],
    verify: ([answer]) => {
      assert(/[\u0600-\u06ff]/.test(answer), "arabic-currency-fit: answer is not Arabic.");
      assert(/\$\s?320|320\s?(\$|USD|دولار)/i.test(answer), "arabic-currency-fit: exact USD currency is missing or changed.");
      assert(containsAny(answer, [/14\s?إنش/i, /لابتوب/i, /الدوام/i]), "arabic-currency-fit: missed the verified work/laptop fit.");
      assert(!/320\s?(ر\.?س|ريال)/i.test(answer), "arabic-currency-fit: incorrectly changed USD to SAR.");
    },
  },
  {
    id: "distinct-follow-up",
    productSlug: "everyday-leather-tote",
    productName: "Everyday Leather Tote",
    locale: "en",
    messages: [
      "What is the exact price?",
      "What is the main drawback for daily commuting?",
    ],
    verify: ([first, second]) => {
      assert(/\$\s?320|320\s?(USD|dollars?)/i.test(first), "distinct-follow-up: exact USD price is missing.");
      assert(!/^\s*(it costs|the price is|it is \$?320)/i.test(second), "distinct-follow-up: repeated the price instead of answering the drawback.");
      assert(containsAny(second, [/dimension/i, /leather/i, /patina/i, /maintain/i, /weight/i, /zip/i, /closure/i, /weather/i, /not listed/i]), "distinct-follow-up: did not give a grounded limitation.");
    },
  },
];

const results = [];
for (const journey of journeys) {
  results.push(await runJourney(journey));
  process.stdout.write(`✓ ${journey.id}\n`);
}

console.log(JSON.stringify({
  status: "passed",
  baseUrl,
  journeys: results.length,
  turns: results.reduce((sum, result) => sum + result.turns, 0),
  results,
}, null, 2));
