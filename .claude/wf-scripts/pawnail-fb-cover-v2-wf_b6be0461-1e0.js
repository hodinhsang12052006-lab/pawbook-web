export const meta = {
  name: 'pawnail-fb-cover-v2',
  description: 'Professional tech-forward Facebook cover for PawNail: 3 designers render distinct HTML concepts with real app screens, 2 judges score with Facebook crop previews, refine the winner to a final 1640x924',
  phases: [
    { title: 'Concepts', detail: 'three distinct directions, each rendered to PNG with desktop/mobile crop previews' },
    { title: 'Judge', detail: 'creative director + social/ads specialist score every concept' },
    { title: 'Refine', detail: 'polish the winner, final render + checks' },
  ],
}
const A = args
const CTX = `Brand: PawNail (operated by BitPaw; Facebook page name 'BitPaw Os', verified). Product: a professional technology platform for the nail industry in the United States and Australia — salons hire and get booked, nail techs showcase work and find their next chair, clients discover designs, try looks on a photo of their own hand and request bookings. Real features: jobs board (pay type, photos/video, by state), tech portfolios (see which salons viewed you), salon service menus with QR code + booking requests inbox, daily design ideas (AI illustrations), PawNail Try-On, in-app chat with voice/video calls, English & Tiếng Việt. Tagline: 'The nail industry, connected.' Website: bitpawos.com. Visual language of the app (new 'warm luxe dark'): plum-charcoal ground around #16111a-#1d1622, rose accent #e8508a-ish used sparingly, champagne-gold secondary (#e9d3a8), soft tinted shadows, glass surfaces, real photography; never neon, never pitch black.
The owner rejected the first cover (nail photos + wordmark) as not tech enough: he wants a deeper, fully professional, technology-company cover that a US/AU salon owner instantly reads as serious software.
ASSETS (use them; do not invent fake UI): real app screens captured from the product at 412x860 phone size — ${A.v2} (latest UI v2: en_tech_home.png, en_tech_chat.png, en_tech_messages.png, en_tech_jobs.png, en_tech_job.png, en_tech_designs.png, en_tech_profile_me.png, en_owner_home.png …) and ${A.store} (01_jobs.png, 02_tryon.png and 02_tryon_look*.png, 04_chat.png, 06_profile.png, 08_designs.png — older palette, crops/elements may still help); curated Google Flow nail photos (AI illustrations) in ${A.photos} (D001..D213.jpg); app icon ${A.logo} (neon 'B', it is also the page profile picture — you may include it small, never alter it). Optional fonts from Google Fonts (e.g. Fraunces, Inter, Geist, Be Vietnam Pro) loaded in the HTML.
HARD RULES: no fake metrics (no user counts, ratings, 'trusted by', '#1', 'leading'), no fake reviews/testimonials, no fake logos/partners, no store badges (the app is not public yet), any nail photo used as design content is labelled 'AI illustration' somewhere small; text must be crisp and legible at Facebook's display size; English copy (a tiny 'English · Tiếng Việt' line is fine).
FACEBOOK FORMAT: upload 1640x924. Desktop shows roughly the middle 1640x624 band (about 150px cropped top and bottom) and the page profile picture overlaps the bottom-left corner below the cover; mobile shows close to the full frame but small. Keep all critical content inside a safe zone of about x 100-1540, y 170-754, keep the bottom-left 420x200 calm.
RENDERING: write a self-contained HTML file (inline CSS, local asset paths via file:// absolute URLs or copies next to the HTML) in your own folder under ${A.out}, render it with Playwright (node, require from ${A.pw}) at exactly 1640x924 deviceScaleFactor 1 to <name>.png, and also produce preview crops: desktop band (0,150,1640,774) scaled to 820x312, and mobile full frame scaled to 640x360. Look at your renders and iterate until they are genuinely premium (Linear / Stripe / Fresha / Apple level craft: real device frames or clean floating UI panels, perfect alignment, typographic hierarchy, depth). Final message is machine-read.`
const OUT = { type: 'object', properties: { name: { type: 'string' }, html: { type: 'string' }, png: { type: 'string' }, desktopCrop: { type: 'string' }, mobileCrop: { type: 'string' }, rationale: { type: 'string' } }, required: ['name', 'html', 'png', 'desktopCrop', 'mobileCrop', 'rationale'] }
const DIRS = [
  { key: 'devices', brief: 'Direction A, PRODUCT ON DEVICES: two or three real app screens in precise, modern phone frames (and optionally a laptop/tablet showing the web app), arranged with depth and perspective on the right; confident headline and a concise feature line on the left; subtle connective motif (fine lines/nodes) suggesting the network of salons, techs and clients.' },
  { key: 'ui-system', brief: 'Direction B, FLOATING UI SYSTEM: no device frames; extract real UI elements from the screenshots (a job card, a chat thread with bubbles, a booking request, a Try-On result, a design card) as crisp floating glass panels in a layered isometric-ish composition, like a premium SaaS hero; headline + subline; one AI-illustration nail photo integrated as content of a card.' },
  { key: 'network', brief: 'Direction C, CONNECTED INDUSTRY: an abstract, elegant data/network visual (US + Australia as minimal dotted maps or orbit arcs linking roles: Salons · Nail techs · Clients) combined with one hero phone screen and two small UI chips; very restrained, editorial, high-end tech feel.' },
]
phase('Concepts')
const concepts = (await parallel(DIRS.map((d) => () => agent(`${CTX}

You are a senior brand + product designer. ${d.brief} Work in ${A.out}/${d.key}. Produce your best version.`, { label: `concept:${d.key}`, phase: 'Concepts', schema: OUT })))).filter(Boolean)

phase('Judge')
const JUDGE = { type: 'object', properties: { ranking: { type: 'array', items: { type: 'string' } }, scores: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, score: { type: 'number' }, notes: { type: 'string' } }, required: ['name', 'score', 'notes'] } }, winner: { type: 'string' }, refinements: { type: 'array', items: { type: 'string' } } }, required: ['ranking', 'scores', 'winner', 'refinements'] }
const judges = (await parallel([
  'creative director at a top SaaS brand agency (Stripe/Linear/Notion level), strict about craft, hierarchy, alignment, typography and honesty',
  'social media and paid ads specialist for US/AU beauty-tech brands, judging how it reads at Facebook desktop and mobile sizes, crop safety, legibility and instant comprehension for salon owners',
].map((who) => () => agent(`${CTX}

You are a ${who}. Judge these concepts by viewing every PNG and both crop previews (use the Read tool on the image files): ${JSON.stringify(concepts)}. Score 1-10, rank, pick a winner, and list concrete refinements for the winner (and any element worth borrowing from the others).`, { label: `judge:${who.split(' ')[0]}`, phase: 'Judge', schema: JUDGE })))).filter(Boolean)

phase('Refine')
const tally = {}
for (const j of judges) for (const s of j.scores) tally[s.name] = (tally[s.name] || 0) + s.score
const winnerName = Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0]
const winner = concepts.find((c) => c.name === winnerName) || concepts[0]
const final = winner ? await agent(`${CTX}

CONTINUATION: a previous refiner was cut off by a usage limit; its partial files are in ${A.out}/final (check them first and continue from the best state). Refine the winning concept ${JSON.stringify(winner)} using every judge refinement: ${JSON.stringify(judges.map((j) => j.refinements))}. Borrow strong elements from the others if the judges suggested it: ${JSON.stringify(concepts.filter((c) => c !== winner).map((c) => c.png))}. Work in ${A.out}/final. Render final.png (1640x924) plus the desktop and mobile crops, verify the safe zones and legibility yourself, and report.`, { label: 'refine', phase: 'Refine', schema: OUT }) : null
return { concepts, judges, tally, final }