// Agrieasy.ai — crop plan generator (sowing → selling), offline & deterministic.
// Works in browser (window.PlanGen) and Node (module.exports) for testing.
window.PlanGen = (function () {
  const fmt = d => d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const addDays = (iso, n) => { const d = new Date(iso); d.setDate(d.getDate() + n); return d; };

  function generatePlan(input) {
    const kb = window.KB;
    const crop = kb.crops.find(c => c.id === input.cropId);
    if (!crop) return "**Crop not found.**";
    const acres = Math.max(0.1, Number(input.acres) || 1);
    const sowISO = input.sowDate || new Date().toISOString().slice(0, 10);
    const district = input.district ? ` (${input.district})` : "";

    const cost = Math.round(crop.costPerAcre * acres);
    const revAvg = Math.round(crop.yieldAvg * acres * crop.assumePrice);
    const revGood = Math.round(crop.yieldGood * acres * crop.assumePrice);
    const outQtyAvg = Math.round(crop.yieldAvg * acres);
    const outQtyGood = Math.round(crop.yieldGood * acres);
    const n = x => x.toLocaleString("en-IN");

    let md = `# ${crop.name} (${crop.hi}) full-season plan — ${acres} acre${acres > 1 ? "s" : ""}${district}\n\n`;
    md += `**Sowing date:** ${fmt(new Date(sowISO))} (window: ${crop.sowWindow}) · **Season:** ${crop.season} · **Duration:** ~${crop.durationDays} days\n\n`;
    md += `## Money picture (indicative — verify live prices)\n`;
    md += `- **Estimated cost:** ₹${n(cost)} (₹${n(crop.costPerAcre)}/acre: seed, fertilizer, labour, machine, plant protection)\n`;
    md += `- **Expected output:** ${n(outQtyAvg)} q average · ${n(outQtyGood)} q with good management\n`;
    md += `- **Gross at assumed ₹${n(crop.assumePrice)}/q:** ₹${n(revAvg)} average · ₹${n(revGood)} good\n`;
    md += `- **Assumed price is a planning number only** — check MSP + live AgriEasy/eNAM price before selling\n\n`;

    md += `## Field setup\n`;
    md += `- **Seed & sowing:** ${crop.seedRate}; spacing ${crop.spacing}\n`;
    md += `- **Fertilizer:** ${crop.fertilizer}\n`;
    md += `- **Irrigation:** ${crop.irrigation}\n\n`;

    md += `## Timeline — kya kab karna hai\n\n`;
    crop.ops.forEach(op => {
      const d = addDays(sowISO, op.d);
      md += `**${fmt(d)}** ${op.d < 0 ? "(pre-sowing)" : `(day ${op.d})`} — **${op.t}**\n${op.x}\n\n`;
    });

    md += `## Watch-outs\n`;
    md += `- **Pests:** ${crop.pests}\n`;
    md += `- **Diseases:** ${crop.diseases}\n`;
    md += `- Any pesticide: correct label dose only; confirm with your KVK/agri officer\n\n`;

    md += `## Harvest\n`;
    md += `- **Signs:** ${crop.harvest}\n`;
    md += `- **Post-harvest:** ${crop.postharvest}\n\n`;

    md += `## Selling on AgriEasy (agrieasy.site)\n`;
    md += `1. Grade the lot (${crop.postharvest.split(";")[0].toLowerCase()}) — graded lots sell faster at better price\n`;
    md += `2. Photos in daylight on a plain tarpaulin: whole lot + close-up + weighing (3–5 photos)\n`;
    md += `3. List with: variety, grade, quantity, moisture, location, price — fill every field\n`;
    md += `4. Reply to buyers the same day; be honest about quality\n`;
    md += `5. **Payment: AgriEasy platform payment/UPI — never cash-only to unknown buyers**\n`;
    md += `6. Weigh with buyer present, photograph the loaded vehicle + weight slip\n`;
    md += `7. Save the sale record; rate the buyer — repeat buyers are the real premium\n\n`;
    md += `**Channel mix:** ${crop.marketing}\n\n`;

    md += `---\n*Indicative plan generated offline by Agrieasy.ai — confirm doses/timings with your local KVK, and check live prices in the app. ${kb.helpline}*\n`;
    return md;
  }

  return { generatePlan };
})();
if (typeof module !== "undefined") module.exports = window.PlanGen;
