export const meta = {
  name: 'passive-audit',
  description: 'Audit every card passive/special vs the source docs; verify each mismatch',
  phases: [
    { title: 'Audit', detail: 'one agent per element vs its *_Cards.docx text' },
    { title: 'Verify', detail: 'adversarially confirm each mismatch is real + modelable' },
  ],
}

const SCRATCH = 'C:/Users/ILIKIN~1/AppData/Local/Temp/claude/C--Users-IlIKingPin-creed-app/01ed8ff6-e9d1-43b6-84c3-94d2172613eb/scratchpad'
const CAPS = `${SCRATCH}/ENGINE_CAPS.md`
const ELEMENTS = ['LEAF', 'AQUA', 'PYRO', 'BORE', 'GALE', 'BOLT', 'DUSK', 'DAWN']

const FINDINGS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          cardId: { type: 'string', description: 'the id: "..." in cards.ts' },
          cardName: { type: 'string' },
          docText: { type: 'string', description: 'the passive/special quoted verbatim from the doc' },
          currentImpl: { type: 'string', description: 'concise summary of the relevant fields in cards.ts today, or "MISSING"' },
          problem: { type: 'string', description: 'what is missing/wrong vs the doc' },
          suggestedFix: { type: 'string', description: 'concrete cards.ts field-level change using ENGINE_CAPS fields' },
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
        required: ['cardId', 'cardName', 'docText', 'currentImpl', 'problem', 'suggestedFix', 'severity'],
      },
    },
  },
  required: ['findings'],
}

const VERDICT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    cardId: { type: 'string' },
    cardName: { type: 'string' },
    confirmed: { type: 'boolean', description: 'true only if this is a REAL mismatch AND fixable with existing engine fields' },
    reason: { type: 'string' },
    docText: { type: 'string' },
    currentImpl: { type: 'string' },
    finalFix: { type: 'string', description: 'the exact cards.ts field change to apply (field: value), or empty if not confirmed' },
    severity: { type: 'string', enum: ['high', 'medium', 'low'] },
  },
  required: ['cardId', 'cardName', 'confirmed', 'reason', 'finalFix', 'severity'],
}

const auditPrompt = (el) => `You are auditing the WAR ELEMENT card game's ${el} cards: does the code faithfully
implement each card's PASSIVE and SPECIAL as written in the source design doc?

Read these THREE files fully, in order:
1. ${CAPS}  — the engine capabilities cheatsheet. It lists every field/handler the engine CAN model, and (critically) the mechanics that are UNMODELED (approximations are acceptable for those).
2. ${SCRATCH}/carddocs/${el}.txt  — the source design doc for ${el}. This is the SOURCE OF TRUTH for abilities.
3. C:/Users/IlIKingPin/war-element/src/data/cards.ts — the implementation. Grep it for \`element: "${el}"\` and read each ${el} card's full object block (id, special, and every passive field). Also read the ${el} TOKENS if any.

For EACH ${el} card that exists in BOTH the doc and cards.ts, compare the doc's Passive(s)/Special/On-Summon/On-Kill/On-Death/Aura text against the implemented fields.

Report a finding ONLY when BOTH are true:
- The implementation is MISSING a documented effect, or has the WRONG status/value/trigger/target; AND
- The correct version is MODELABLE with the fields in ENGINE_CAPS.md (e.g. a second status via barrage debuffStatus, a wrong duration/power, a missing onKill/onDeath/roundTick, a status that should be applied but isn't).

Do NOT report:
- Base stat totals (the codebase intentionally rebalances to 5*cost+10 — only ability LOGIC matters).
- Effects that need a genuinely UNMODELED mechanic (traps, pulls/teleports, per-use scaling, "next N attacks", equip, choose-a-buff, etc.) where the impl is already a reasonable stand-in.
- Cards in cards.ts that are NOT in the ${el} doc (older names) — skip them.
- Cosmetic naming.

Known example to calibrate: AQUA Krakler's doc On-Summon is "SCALD 3 DOT AND FREEZE 2 rounds" but the code only applies FREEZE — that IS a valid finding (add the SCALD half via barrage statusKind:SCALD/statusPower:3 + debuffStatus:FREEZE). Find every case like this.

Be thorough and precise. Quote the doc text verbatim in docText. In suggestedFix give the concrete field change. Return ALL findings for ${el}.`

const verifyPrompt = (f) => `Adversarially verify ONE claimed passive-implementation mismatch in the WAR ELEMENT game.

Card: ${f.cardName} (${f.cardId})
Doc text claimed: ${JSON.stringify(f.docText)}
Current impl claimed: ${JSON.stringify(f.currentImpl)}
Problem claimed: ${f.problem}
Suggested fix: ${f.suggestedFix}

Your job is to CONFIRM or REJECT. Default to REJECT unless you can prove it.
1. Read ${CAPS} (what's modelable / what's unmodeled).
2. Open ${SCRATCH}/carddocs/${f.cardName ? f.cardId.split('_')[0].toUpperCase() : ''}.txt and find ${f.cardName}; read its real doc text (the finding may have misquoted).
3. Grep C:/Users/IlIKingPin/war-element/src/data/cards.ts for id "${f.cardId}" and read the ACTUAL current fields.

Confirm=true ONLY if: the doc really says what's claimed, the code really lacks/misimplements it, AND the fix is expressible with real ENGINE_CAPS fields (correct handler + param names that exist in the engine). If the effect needs an unmodeled mechanic, or the code is already faithful, or the fix uses a non-existent param, set confirmed=false.

Give finalFix as the precise cards.ts change (the exact field: value to add/replace, using real param names). Keep the doc/impl text accurate to what you actually read.`

// ── Phase 1: audit each element ─────────────────────────────────────────────
phase('Audit')
const audits = await parallel(
  ELEMENTS.map((el) => () =>
    agent(auditPrompt(el), { label: `audit:${el}`, phase: 'Audit', schema: FINDINGS_SCHEMA, effort: 'high' })
  )
)
const allFindings = audits.filter(Boolean).flatMap((a) => a.findings || [])
log(`raw findings: ${allFindings.length} across ${ELEMENTS.length} elements`)

// ── Phase 2: adversarially verify each finding ──────────────────────────────
phase('Verify')
const verdicts = await parallel(
  allFindings.map((f) => () =>
    agent(verifyPrompt(f), { label: `verify:${f.cardId}`, phase: 'Verify', schema: VERDICT_SCHEMA, effort: 'high' })
      .then((v) => (v ? { ...v, _orig: f } : null))
  )
)
const confirmed = verdicts.filter(Boolean).filter((v) => v.confirmed)
log(`confirmed fixable mismatches: ${confirmed.length} / ${allFindings.length}`)

// Sort most-severe first for the apply pass
const order = { high: 0, medium: 1, low: 2 }
confirmed.sort((a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3))

return {
  totalRaw: allFindings.length,
  confirmedCount: confirmed.length,
  confirmed: confirmed.map((v) => ({
    cardId: v.cardId, cardName: v.cardName, severity: v.severity,
    docText: v.docText, currentImpl: v.currentImpl, finalFix: v.finalFix, reason: v.reason,
  })),
}
