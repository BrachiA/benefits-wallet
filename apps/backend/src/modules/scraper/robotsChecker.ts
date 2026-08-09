import { logger } from '../../lib/logger';

// בדיקה אוטומטית וזולה: אם robots.txt של המקור אוסר על ה-path,
// חוסמים לפני שמגיעים בכלל לבדיקת ToS האנושית. זו רשת ביטחון
// טכנית נוספת — לא תחליף לקריאה אנושית של ה-Terms of Service,
// כי robots.txt לא משקף התניות חוזיות (למשל "אסור scraping אוטומטי
// גם אם ה-path פתוח טכנית").
export const robotsChecker = {
  async isAllowed(baseUrl: string, path: string): Promise<{ allowed: boolean; reason?: string }> {
    try {
      const robotsUrl = new URL('/robots.txt', baseUrl).toString();
      const response = await fetch(robotsUrl, { signal: AbortSignal.timeout(5000) });

      if (!response.ok) {
        // אין robots.txt = לא אסור טכנית, אך זה לא אישור — עדיין
        // תלוי לחלוטין באישור tosStatus שנבדק בנפרד.
        return { allowed: true };
      }

      const text = await response.text();
      const disallowed = this.parseDisallowedPaths(text);

      const isBlocked = disallowed.some((rule) => path.startsWith(rule));
      if (isBlocked) {
        return { allowed: false, reason: `robots.txt disallows path: ${path}` };
      }
      return { allowed: true };
    } catch (err) {
      // כשל ברשת בבדיקת robots.txt לא אמור לחסום את כל התהליך —
      // נרשם ללוג, אך ה-tosStatus הידני הוא עדיין השער האמיתי.
      logger.warn({ baseUrl, err }, 'Failed to check robots.txt, proceeding on ToS approval alone');
      return { allowed: true };
    }
  },

  // פרסור מינימלי: מחפש בלוקים תחת "User-agent: *" ומחלץ Disallow.
  // לא מטפל ב-crawl-delay/sitemap — מספיק לצורך רשת הביטחון הזו.
  parseDisallowedPaths(robotsTxt: string): string[] {
    const lines = robotsTxt.split('\n').map((l) => l.trim());
    const disallowed: string[] = [];
    let inGlobalBlock = false;

    for (const line of lines) {
      if (/^user-agent:\s*\*/i.test(line)) {
        inGlobalBlock = true;
        continue;
      }
      if (/^user-agent:/i.test(line)) {
        inGlobalBlock = false;
        continue;
      }
      if (inGlobalBlock) {
        const match = line.match(/^disallow:\s*(.+)$/i);
        if (match && match[1].trim()) disallowed.push(match[1].trim());
      }
    }
    return disallowed;
  },
};
