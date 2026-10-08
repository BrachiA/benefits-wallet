import type {
  ApiEnvelope,
  BrandOption,
  CategorizationReport,
  CleanupReport,
  ExtractionResult,
  IngestReport,
  PaginatedEnvelope,
  ProgramOption,
} from './types';

// ============================================================
// כלי ניהול נפרד לגמרי ממודול ה-ScraperSource הרגיל של הבקאנד.
// אין כאן שום תזמון, שום cron, ושום קריאה שיכולה להיות יזומה
// משרת — כל הרצה מתחילה בלחיצה על הכפתור למטה, בכל פעם מחדש.
// ============================================================

const STORAGE_KEYS = { backendUrl: 'bw_backend_url', token: 'bw_admin_token' } as const;
const DEFAULT_BACKEND_URL = 'http://localhost:4000';

function el<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing element #${id}`);
  return found as T;
}

const backendUrlInput = el<HTMLInputElement>('backendUrl');
const tokenInput = el<HTMLInputElement>('token');
const passwordInput = el<HTMLInputElement>('loginPassword');
const loginButton = el<HTMLButtonElement>('loginButton');
const anchorSelect = el<HTMLSelectElement>('anchorSelect');
const scanButton = el<HTMLButtonElement>('scanButton');
const statusEl = el<HTMLDivElement>('status');
const summaryEl = el<HTMLPreElement>('summary');
const cleanupButton = el<HTMLButtonElement>('cleanupButton');
const cleanupStatusEl = el<HTMLDivElement>('cleanupStatus');
const categorizeButton = el<HTMLButtonElement>('categorizeButton');
const categorizeStatusEl = el<HTMLDivElement>('categorizeStatus');

let anchorOptionsLoaded = false;

async function loadSettings(): Promise<void> {
  const stored = await chrome.storage.local.get([STORAGE_KEYS.backendUrl, STORAGE_KEYS.token]);
  backendUrlInput.value = (stored[STORAGE_KEYS.backendUrl] as string | undefined) ?? DEFAULT_BACKEND_URL;
  tokenInput.value = (stored[STORAGE_KEYS.token] as string | undefined) ?? '';

  // טעינה שקטה של רשימת המועדונים/מותגים — רק אם ההרשאה כבר ניתנה
  // בעבר (chrome.permissions.contains אינו פותח פרומפט ואינו דורש
  // user gesture, בניגוד ל-request). אם עדיין לא אושרה גישה לכתובת
  // הזו, הרשימה תיטען אחרי ההתחברות/הסריקה הראשונה במקום.
  const backendUrl = normalizeBackendUrl(backendUrlInput.value);
  if (backendUrl) {
    const granted = await chrome.permissions.contains({ origins: [`${new URL(backendUrl).origin}/*`] });
    if (granted) await loadAnchorOptions(backendUrl);
  }
}

async function saveSettings(): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.backendUrl]: backendUrlInput.value.trim(),
    [STORAGE_KEYS.token]: tokenInput.value.trim(),
  });
}

type StatusKind = 'idle' | 'scanning' | 'sending' | 'success' | 'error';

function setStatus(kind: StatusKind, message: string): void {
  statusEl.textContent = message;
  statusEl.className = `status status--${kind}`;
}

function normalizeBackendUrl(raw: string): string | null {
  const trimmed = raw.trim().replace(/\/+$/, '');
  try {
    const url = new URL(trimmed);
    return url.origin + url.pathname.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

// מבקשת גישת רשת לדומיין הספציפי הזה בלבד (לא <all_urls>) — הרשאה
// אופציונלית שנשאלת בזמן ריצה, לא נכללת מראש ב-manifest.json.
// אישור המנהלת מוצג כפרומפט חד-פעמי של Chrome לדומיין הזה בדיוק.
async function ensureBackendPermission(origin: string): Promise<boolean> {
  const pattern = `${origin}/*`;
  const has = await chrome.permissions.contains({ origins: [pattern] });
  if (has) return true;
  return chrome.permissions.request({ origins: [pattern] });
}

// ============================================================
// שיוך per-request: מועדון/מותג לריצת הסריקה הזו בלבד — לא נשמר
// כברירת מחדל על המקור המשותף (__browser_extension_ingest__),
// אחרת בחירה בריצה אחת הייתה "נדבקת" לכל ריצה עתידית גם על אתר
// אחר לגמרי. משתמש ב-endpoints הציבוריים הקיימים (GET /programs,
// GET /brands) שהדשבורד כבר צורך — לא נוצר endpoint חדש.
// ============================================================
async function loadAnchorOptions(backendUrl: string): Promise<void> {
  try {
    // בכוונה בלי cache: אין TTL, אין chrome.storage לרשימה עצמה — כל פתיחת
    // popup טוענת מחדש מה-backend. הרשימה קטנה (עשרות רשומות), אז אין
    // תועלת אמיתית ב-cache, ורענון תמידי מונע פערי עדכניות. cache: 'no-store'
    // מוסיף הגנה מפורשת גם מול cache של דפדפן/proxy (לא רק ה-JS context
    // הנקי שממילא נוצר בכל פתיחת popup אמיתית). אם מתפתה להוסיף cache
    // בעתיד — זו החלטה מודעת שדורשת מחשבה מחדש, לא רק "לחיסכון".
    const [programsRes, brandsRes] = await Promise.all([
      fetch(`${backendUrl}/api/v1/programs?pageSize=100&isActive=true`, { cache: 'no-store' }),
      fetch(`${backendUrl}/api/v1/brands?pageSize=100&isActive=true`, { cache: 'no-store' }),
    ]);
    const programsBody = (await programsRes.json()) as PaginatedEnvelope<ProgramOption>;
    const brandsBody = (await brandsRes.json()) as PaginatedEnvelope<BrandOption>;

    anchorSelect.innerHTML = '<option value="">— בלי שיוך —</option>';

    if (programsBody.success && programsBody.data.length > 0) {
      const group = document.createElement('optgroup');
      group.label = 'מועדונים/כרטיסים';
      for (const program of programsBody.data) {
        const opt = document.createElement('option');
        opt.value = `program:${program.id}`;
        opt.textContent = program.name;
        group.appendChild(opt);
      }
      anchorSelect.appendChild(group);
    }

    if (brandsBody.success && brandsBody.data.length > 0) {
      const group = document.createElement('optgroup');
      group.label = 'מותגים';
      for (const brand of brandsBody.data) {
        const opt = document.createElement('option');
        opt.value = `brand:${brand.id}`;
        opt.textContent = brand.name;
        group.appendChild(opt);
      }
      anchorSelect.appendChild(group);
    }

    anchorOptionsLoaded = true;
  } catch {
    // כשל בטעינת הרשימה לא אמור לחסום סריקה — השדה נשאר אופציונלי,
    // פשוט לא יהיה ממה לבחור עד שהרשימה תיטען בהצלחה (למשל בפעם
    // הבאה, אחרי שהגישה לשרת אושרה).
  }
}

// פרסינג של ה-option שנבחר (`program:<id>` / `brand:<id>`) לגוף
// הבקשה של ה-ingest.
function parseAnchorSelection(value: string): { programId?: string; brandId?: string } {
  if (value.startsWith('program:')) return { programId: value.slice('program:'.length) };
  if (value.startsWith('brand:')) return { brandId: value.slice('brand:'.length) };
  return {};
}

// ============================================================
// חילוץ מה-DOM החי. מוזרקת דרך chrome.scripting.executeScript עם
// activeTab בלבד (לא content_scripts קבוע ב-manifest) — כלומר רצה
// פעם אחת, רק בלחיצת הכפתור, ורק על הטאב הפעיל באותו רגע. הפונקציה
// הזו חייבת להישאר עצמאית לגמרי (בלי סגירה על משתנים חיצוניים):
// Chrome מסריאלז אותה ומריץ אותה מחדש בהקשר של הדף, לא כאן.
//
// נבדקה בפועל (Playwright, כרום headless אמיתי) מול 3 אתרים:
// ✅ books.toscrape.com — סטטי, 20/20 כרטיסים נכונים (כותרת/מחיר/
//    תמונה/קישור).
// ✅ scrapingcourse.com/ecommerce — WooCommerce אמיתי, 16/20 מוצרים
//    (4 שהוחסרו היו ככל הנראה out-of-stock בלי טקסט מחיר).
// ⚠️ react-shopping-cart דמו (styled-components, class מוצפן
//    לגמרי) — 0 פריטים; לא נמצא אף טקסט מחיר בעמוד גם ב-DOM
//    המרונדר, כנראה בעיה בדמו עצמו ולא ביכולת הרינדור. ממחיש בכל
//    זאת בדיוק את המקרה הבעייתי (class ללא שום מילת מפתח סמנטית)
//    שדווח כסיכון גם בבדיקת שלב 8.
// ============================================================
function extractBenefitsFromPage(): ExtractionResult {
  const warnings: string[] = [];

  function absUrl(value: string | null | undefined): string | undefined {
    if (!value) return undefined;
    try {
      return new URL(value, document.baseURI).href;
    } catch {
      return undefined;
    }
  }

  function textOf(node: Element | null): string {
    return (node?.textContent ?? '').replace(/\s+/g, ' ').trim();
  }

  function parsePriceNumbers(text: string): number[] {
    const matches = text.match(/\d{1,3}(?:,\d{3})*(?:\.\d+)?/g) ?? [];
    return matches.map((m) => Number(m.replace(/,/g, ''))).filter((n) => Number.isFinite(n));
  }

  function hasPriceSignal(node: Element): boolean {
    const text = textOf(node);
    return /[₪$€£]\s*\d|\d\s*[₪$€£]|\d{1,3}\s*%/i.test(text) || !!node.querySelector('[class*="price" i]');
  }

  function findPriceInfo(card: Element): { original?: number; discounted?: number; percent?: number } {
    const text = textOf(card);
    const percentMatch = text.match(/(\d{1,3})\s*%/);
    const percent = percentMatch ? Number(percentMatch[1]) : undefined;

    const strikeEl = card.querySelector(
      'del, s, [class*="strike" i], [class*="old-price" i], [class*="original-price" i]'
    );
    const strikeNums = strikeEl ? parsePriceNumbers(textOf(strikeEl)) : [];

    const priceEls = Array.from(card.querySelectorAll('[class*="price" i], [class*="cost" i]')).filter(
      (n) => n !== strikeEl
    );
    const priceNums = priceEls.flatMap((n) => parsePriceNumbers(textOf(n)));

    if (strikeNums.length && priceNums.length) {
      return { original: strikeNums[0], discounted: priceNums[0], percent };
    }
    if (priceNums.length >= 1) {
      return { discounted: priceNums[0], percent };
    }
    const allNums = parsePriceNumbers(text);
    if (allNums.length >= 1) {
      return { discounted: allNums[0], percent };
    }
    return { percent };
  }

  // בדיקת "אב רועש" (ניווט/עגלה/פוטר) עם עומק חסום והתאמת token
  // מדויקת — לא substring. "right-sidebar" על ה-<body> (נפוץ בתבניות
  // WordPress) לא אמור לפסול כל אלמנט בעמוד רק כי "sidebar" מופיע
  // כתת-מחרוזת בתוך token אחר.
  const NOISE_TAGS = new Set(['NAV', 'HEADER', 'FOOTER']);
  const NOISE_CLASS_TOKENS = new Set([
    'nav',
    'navigation',
    'menu',
    'breadcrumb',
    'breadcrumbs',
    'mini-cart',
    'minicart',
    'widget',
    'sidebar',
    'footer',
    'header',
  ]);
  const NOISE_MAX_DEPTH = 6;

  function isNoiseAncestor(node: Element): boolean {
    let current: Element | null = node;
    let depth = 0;
    while (current && current !== document.body && depth < NOISE_MAX_DEPTH) {
      if (NOISE_TAGS.has(current.tagName)) return true;
      const classes = current.classList ? Array.from(current.classList).map((c) => c.toLowerCase()) : [];
      if (classes.some((c) => NOISE_CLASS_TOKENS.has(c))) return true;
      if (current.id && NOISE_CLASS_TOKENS.has(current.id.toLowerCase())) return true;
      current = current.parentElement;
      depth++;
    }
    return false;
  }

  function scoreMember(node: Element): number {
    let score = 0;
    if (node.querySelector('img')) score += 2;
    if (hasPriceSignal(node)) score += 3;
    if (node.closest('a') || node.querySelector('a[href]')) score += 1;
    const len = textOf(node).length;
    if (len >= 10 && len <= 600) score += 1;
    if (node.querySelector('h1, h2, h3, h4, [class*="title" i], [class*="name" i]')) score += 1;
    return score;
  }

  // מקבצים לפי הורה משותף בלבד (לא class מדויק) — אתרים רבים שותלים
  // מזהה ייחודי בתוך ה-class עצמו (post-1063), מה שהופך התאמת class
  // מדויקת לחסרת תועלת: כל כרטיס נראה "ייחודי". אחווה תחת אותו הורה
  // היא סימן חזק בהרבה.
  function pickBestGroup(candidates: Element[]): Element[] {
    const parentGroups = new Map<Element, Element[]>();
    for (const node of candidates) {
      const parent = node.parentElement;
      if (!parent) continue;
      const list = parentGroups.get(parent) ?? [];
      list.push(node);
      parentGroups.set(parent, list);
    }

    // כל קבוצה שעוברת את הסף (>=3 חברים מהתגית הדומיננטית, ציון
    // ממוצע >=3) נאספת כ"מועמדת תקפה" — לא רק המנצחת. נחוץ כדי
    // להחליט למטה אם לאחד קבוצות או להישאר עם המנצחת בלבד.
    const qualifyingGroups: Element[][] = [];
    let bestGroup: Element[] = [];
    let bestAvgScore = 0;
    for (const list of parentGroups.values()) {
      if (list.length < 3) continue;
      const tagCounts = new Map<string, number>();
      for (const node of list) tagCounts.set(node.tagName, (tagCounts.get(node.tagName) ?? 0) + 1);
      const dominantTag = [...tagCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
      const members = list.filter((node) => node.tagName === dominantTag);
      if (members.length < 3) continue;

      const avgScore = members.reduce((sum, node) => sum + scoreMember(node), 0) / members.length;
      if (avgScore < 3) continue;

      qualifyingGroups.push(members);

      const better =
        avgScore > bestAvgScore + 0.5 || (Math.abs(avgScore - bestAvgScore) <= 0.5 && members.length > bestGroup.length);
      if (better) {
        bestGroup = members;
        bestAvgScore = avgScore;
      }
    }

    if (qualifyingGroups.length <= 1) return bestGroup;

    // אתרים מסוימים (אושר בבדיקה: max.co.il/benefits/lobby) פורסים
    // את כרטיסי ההטבה על פני הרבה קבוצות-הורה נפרדות (קרוסלה/רשימה
    // נפרדת לכל קטגוריה) במקום רשת שטוחה אחת — שם "הקבוצה המנצחת"
    // הייתה רק 4 מתוך 69 כרטיסים אמיתיים שכבר ב-DOM, פרוסים על פני
    // 19 קבוצות. אם הקבוצה המובילה מהווה פחות מ-60% מסך כל החברים
    // בקבוצות התקפות — זה סימן לאתר "מרובה-קטגוריות" כזה, ומאחדים
    // את כל הקבוצות התקפות. אחרת (קבוצה אחת ברור דומיננטית, השאר
    // כנראה רעש כמו ניווט/רשימת המלצות) נשארים עם המנצחת בלבד,
    // בדיוק כמו ההתנהגות המקורית — מונע גם צירוף רעש באתרים "רגילים".
    const totalMembers = qualifyingGroups.reduce((sum, group) => sum + group.length, 0);
    if (bestGroup.length / totalMembers < 0.6) {
      return qualifyingGroups.flat();
    }
    return bestGroup;
  }

  // שלב 1: סלקטור סמנטי (class מכיל card/item/product/וכו')
  const SEMANTIC_SELECTOR =
    'article, li, [class*="card" i], [class*="item" i], [class*="product" i], [class*="benefit" i], [class*="coupon" i], [class*="deal" i], [class*="offer" i]';
  const semanticCandidates = Array.from(document.querySelectorAll(SEMANTIC_SELECTOR)).filter(
    (node) => !isNoiseAncestor(node)
  );
  let bestGroup = pickBestGroup(semanticCandidates);

  // שלב 2 (fallback): class מוצפן לגמרי (styled-components/CSS
  // modules) בלי אף מילת מפתח סמנטית. מחפשים "עלים מתומחרים" —
  // container עם תמונה בודדת + סימן מחיר — ומקבצים לפי הורה.
  if (bestGroup.length === 0) {
    const broadCandidates = Array.from(document.querySelectorAll('div, li, article, section')).filter((node) => {
      if (isNoiseAncestor(node)) return false;
      if (node.querySelectorAll('img').length !== 1) return false;
      if (!hasPriceSignal(node)) return false;
      const len = textOf(node).length;
      return len > 0 && len < 400;
    });
    bestGroup = pickBestGroup(broadCandidates);
  }

  if (bestGroup.length === 0) {
    warnings.push('לא זוהו כרטיסי הטבה חוזרים בדף — ייתכן שהמבנה של האתר הזה דורש סלקטורים ייעודיים');
  }

  const items: ExtractionResult['items'] = [];
  bestGroup.forEach((card, index) => {
    const titleEl = card.querySelector('h1, h2, h3, h4, [class*="title" i], [class*="name" i]');
    const title = textOf(titleEl) || textOf(card).slice(0, 80);
    if (!title) return;

    const descEl = card.querySelector('p, [class*="desc" i], [class*="subtitle" i]');
    const shortDescription = descEl && descEl !== titleEl ? textOf(descEl) : undefined;

    const cardCategoryEl = card.querySelector('[class*="categor" i]');
    const pageCategoryEl = document.querySelector('nav [aria-current="page"], .breadcrumb [class*="active" i]');
    const category = cardCategoryEl ? textOf(cardCategoryEl) : pageCategoryEl ? textOf(pageCategoryEl) : undefined;

    const imgEl = card.querySelector('img');
    const imageUrl = absUrl(imgEl?.getAttribute('src') ?? imgEl?.getAttribute('data-src') ?? undefined);

    const linkEl = card.closest('a') ?? card.querySelector('a[href]');
    const detailUrl = absUrl(linkEl?.getAttribute('href'));

    const price = findPriceInfo(card);
    const discountValue =
      price.percent !== undefined
        ? price.percent
        : price.original && price.discounted
          ? Math.round(((price.original - price.discounted) / price.original) * 100)
          : price.discounted;
    const discountUnit: 'PERCENT' | 'ILS' | undefined =
      price.percent !== undefined ? 'PERCENT' : price.discounted !== undefined ? 'ILS' : undefined;

    const termsEl = card.querySelector('[class*="terms" i], [class*="condition" i]');
    const termsAndConditions = termsEl ? textOf(termsEl) : undefined;

    const validEl = card.querySelector('[class*="valid" i], [class*="expir" i], time');
    const validUntil = validEl ? (validEl.getAttribute('datetime') ?? textOf(validEl)) : undefined;

    const classIdMatch =
      typeof card.className === 'string' ? card.className.match(/(?:^|[\s-])(?:post|item|product)-(\d+)(?:\s|$)/) : null;
    const rawId =
      card.getAttribute('data-id') ??
      card.getAttribute('id') ??
      classIdMatch?.[1] ??
      linkEl?.getAttribute('href') ??
      `${title}-${index}`;
    const externalId = String(rawId).trim().slice(0, 200) || `card-${index}`;

    items.push({
      externalId,
      title,
      shortDescription,
      category,
      originalPrice: price.original,
      discountedPrice: price.discounted,
      discountValue,
      discountUnit,
      imageUrl,
      termsAndConditions,
      validUntil,
      detailUrl,
    });
  });

  if (bestGroup.length > 0 && items.length === 0) {
    warnings.push('נמצאו כרטיסים אך אף אחד מהם לא הכיל כותרת — ייתכן שה-selectors לא מתאימים למבנה הזה');
  }

  return { items, warnings, pageTitle: document.title, pageUrl: location.href };
}

async function handleLogin(): Promise<void> {
  const backendUrl = normalizeBackendUrl(backendUrlInput.value);
  const password = passwordInput.value;
  if (!backendUrl) {
    setStatus('error', 'כתובת Backend לא תקינה');
    return;
  }
  if (!password) {
    setStatus('error', 'יש להזין את סיסמת הדשבורד');
    return;
  }

  loginButton.disabled = true;
  setStatus('sending', 'מתחברת...');
  try {
    const granted = await ensureBackendPermission(new URL(backendUrl).origin);
    if (!granted) {
      setStatus('error', 'הגישה לכתובת השרת לא אושרה');
      return;
    }

    const res = await fetch(`${backendUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const body = (await res.json()) as ApiEnvelope<{ token: string }>;

    if (!res.ok || !body.success) {
      setStatus('error', !body.success ? body.error.message : `ההתחברות נכשלה (${res.status})`);
      return;
    }

    tokenInput.value = body.data.token;
    passwordInput.value = '';
    await saveSettings();
    await loadAnchorOptions(backendUrl);
    setStatus('success', 'התקבל טוקן חדש ונשמר');
  } catch (err) {
    setStatus('error', `שגיאת רשת: ${err instanceof Error ? err.message : 'לא ידועה'}`);
  } finally {
    loginButton.disabled = false;
  }
}

async function handleScan(): Promise<void> {
  const backendUrl = normalizeBackendUrl(backendUrlInput.value);
  const token = tokenInput.value.trim();
  summaryEl.textContent = '';

  if (!backendUrl) {
    setStatus('error', 'כתובת Backend לא תקינה');
    return;
  }
  if (!token) {
    setStatus('error', 'יש למלא מפתח אימות, או להתחבר עם הסיסמה למעלה');
    return;
  }

  await saveSettings();
  scanButton.disabled = true;

  try {
    const granted = await ensureBackendPermission(new URL(backendUrl).origin);
    if (!granted) {
      setStatus('error', 'הגישה לכתובת השרת לא אושרה');
      return;
    }
    if (!anchorOptionsLoaded) await loadAnchorOptions(backendUrl);

    setStatus('scanning', 'סורקת את העמוד...');
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      setStatus('error', 'לא נמצא טאב פעיל');
      return;
    }

    const injectionResults = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractBenefitsFromPage,
    });
    const result = injectionResults[0]?.result as ExtractionResult | undefined;

    if (!result || result.items.length === 0) {
      setStatus('error', 'לא נמצאו הטבות בעמוד הנוכחי');
      if (result?.warnings.length) summaryEl.textContent = result.warnings.join('\n');
      return;
    }

    const anchor = parseAnchorSelection(anchorSelect.value);

    setStatus('sending', `שולחת ${result.items.length} פריטים לבקאנד...`);
    const res = await fetch(`${backendUrl}/api/v1/scraper/ingest-extension`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        pageUrl: result.pageUrl,
        pageTitle: result.pageTitle,
        items: result.items,
        ...anchor,
      }),
    });
    const body = (await res.json()) as ApiEnvelope<IngestReport>;

    if (res.status === 401 || res.status === 403) {
      setStatus('error', 'האימות נכשל — הטוקן שגוי או פג תוקף. התחברי מחדש עם הסיסמה למעלה.');
      return;
    }
    if (!res.ok || !body.success) {
      setStatus('error', !body.success ? body.error.message : `שגיאה מהשרת (${res.status})`);
      return;
    }

    const report = body.data;
    setStatus('success', 'הסריקה הושלמה בהצלחה');
    const selectedOption = anchorSelect.selectedOptions[0];
    const lines = [
      ...(anchorSelect.value ? [`שיוך שהוחל על הריצה: ${selectedOption?.textContent ?? ''}`] : []),
      `נמצאו בעמוד: ${report.totalItems}`,
      `הטבות חדשות שנוצרו: ${report.created}`,
      `הטבות שעודכנו: ${report.updated}`,
      `הועברו לתור בדיקה: ${report.flagged}`,
      `ללא שינוי/דולגו: ${report.skipped}`,
    ];
    if (report.errors.length) lines.push(`שגיאות בעיבוד: ${report.errors.length}`);
    if (result.warnings.length) lines.push('', ...result.warnings);
    summaryEl.textContent = lines.join('\n');
  } catch (err) {
    setStatus('error', `שגיאת רשת: ${err instanceof Error ? err.message : 'לא ידועה'}`);
  } finally {
    scanButton.disabled = false;
  }
}

// ============================================================
// מסלול הפעלה נפרד ועצמאי מהסריקה למעלה — לא חלק מ-handleScan,
// לא חוסם/משנה את הזרימה האוטומטית שלה (סרוק→שלח בלחיצה אחת
// נשארת בדיוק כמו היום). קוראת לאותו endpoint שה-cron השעתי
// בבקאנד קורא, רק ביוזמת המנהלת ומיד (modules/duplicateCleanup).
// ============================================================
async function handleCleanup(): Promise<void> {
  const backendUrl = normalizeBackendUrl(backendUrlInput.value);
  const token = tokenInput.value.trim();
  cleanupStatusEl.textContent = '';

  if (!backendUrl) {
    cleanupStatusEl.textContent = 'כתובת Backend לא תקינה';
    return;
  }
  if (!token) {
    cleanupStatusEl.textContent = 'יש למלא מפתח אימות, או להתחבר עם הסיסמה למעלה';
    return;
  }

  cleanupButton.disabled = true;
  cleanupStatusEl.textContent = 'מריצה ניקוי...';
  try {
    const granted = await ensureBackendPermission(new URL(backendUrl).origin);
    if (!granted) {
      cleanupStatusEl.textContent = 'הגישה לכתובת השרת לא אושרה';
      return;
    }

    const res = await fetch(`${backendUrl}/api/v1/duplicate-cleanup/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    const body = (await res.json()) as ApiEnvelope<CleanupReport>;

    if (res.status === 401 || res.status === 403) {
      cleanupStatusEl.textContent = 'האימות נכשל — הטוקן שגוי או פג תוקף. התחברי מחדש עם הסיסמה למעלה.';
      return;
    }
    if (!res.ok || !body.success) {
      cleanupStatusEl.textContent = !body.success ? body.error.message : `שגיאה מהשרת (${res.status})`;
      return;
    }

    const report = body.data;
    // pairsSkippedDueToError (לא geminiCallsFailed) — geminiCallsFailed סופר
    // קריאות batch (כל קריאה מכסה עד DUPLICATE_BATCH_SIZE זוגות), אז אחרי
    // המעבר ל-batch המספר הזה לא משקף כמה זוגות בפועל לא נבדקו.
    const failureNote = report.pairsSkippedDueToError
      ? ` ⚠️ ${report.pairsSkippedDueToError} בדיקות AI נכשלו טכנית${report.rateLimitHit ? ' (חריגת מכסה) — ' : ' — '}ינוסו שוב בסבב הבא.`
      : '';
    cleanupStatusEl.textContent =
      `ניקוי הושלם: ${report.itemsSupersededAsOrphans} פריטים יתומים הוחלפו, ` +
      `${report.pairsSupersededAsDuplicates} כפילויות הוחלפו, ${report.pairsFlaggedForReview} סומנו לבדיקה ידנית.` +
      failureNote;
  } catch (err) {
    cleanupStatusEl.textContent = `שגיאת רשת: ${err instanceof Error ? err.message : 'לא ידועה'}`;
  } finally {
    cleanupButton.disabled = false;
  }
}

// ============================================================
// אותה תבנית בדיוק כמו handleCleanup למעלה — מסלול הפעלה נפרד
// ועצמאי, קורא לאותו endpoint שה-cron השעתי בבקאנד קורא (modules/
// aiEnrichment), רק ביוזמת המנהלת ומיד. שימושי בעיקר מיד אחרי
// סריקה, כדי שקטגוריה תתמלא בלי לחכות לסבב הבא.
// ============================================================
async function handleCategorize(): Promise<void> {
  const backendUrl = normalizeBackendUrl(backendUrlInput.value);
  const token = tokenInput.value.trim();
  categorizeStatusEl.textContent = '';

  if (!backendUrl) {
    categorizeStatusEl.textContent = 'כתובת Backend לא תקינה';
    return;
  }
  if (!token) {
    categorizeStatusEl.textContent = 'יש למלא מפתח אימות, או להתחבר עם הסיסמה למעלה';
    return;
  }

  categorizeButton.disabled = true;
  categorizeStatusEl.textContent = 'מריצה קטגוריזציה...';
  try {
    const granted = await ensureBackendPermission(new URL(backendUrl).origin);
    if (!granted) {
      categorizeStatusEl.textContent = 'הגישה לכתובת השרת לא אושרה';
      return;
    }

    const res = await fetch(`${backendUrl}/api/v1/ai-enrichment/categorize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    const body = (await res.json()) as ApiEnvelope<CategorizationReport>;

    if (res.status === 401 || res.status === 403) {
      categorizeStatusEl.textContent = 'האימות נכשל — הטוקן שגוי או פג תוקף. התחברי מחדש עם הסיסמה למעלה.';
      return;
    }
    if (!res.ok || !body.success) {
      categorizeStatusEl.textContent = !body.success ? body.error.message : `שגיאה מהשרת (${res.status})`;
      return;
    }

    const report = body.data;
    const failureNote = report.categorySuggestionErrors
      ? ` ⚠️ ${report.categorySuggestionErrors} בדיקות AI נכשלו טכנית — ינוסו שוב בסבב הבא.`
      : '';
    categorizeStatusEl.textContent =
      `קטגוריזציה הושלמה: ${report.categoriesSuggested} קטגוריות מולאו, ` +
      `${report.categoriesSkippedLowConfidence} נשארו ריקות (AI לא היה בטוח מספיק).` +
      failureNote;
  } catch (err) {
    categorizeStatusEl.textContent = `שגיאת רשת: ${err instanceof Error ? err.message : 'לא ידועה'}`;
  } finally {
    categorizeButton.disabled = false;
  }
}

loginButton.addEventListener('click', () => void handleLogin());
scanButton.addEventListener('click', () => void handleScan());
cleanupButton.addEventListener('click', () => void handleCleanup());
categorizeButton.addEventListener('click', () => void handleCategorize());

void loadSettings();
