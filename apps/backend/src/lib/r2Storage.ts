import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import axios from 'axios';
import { env } from '../config/env';
import { logger } from './logger';

// ============================================================
// עוטף Cloudflare R2 (תואם S3 API) דרך AWS SDK v3 — הדרך הרשמית
// המומלצת ע"י Cloudflare (developers.cloudflare.com/r2, אומת
// 17.8.2026). region:'auto' נדרש ע"י ה-SDK אך לא בשימוש בפועל ע"י
// R2 (אין regions אמיתיים). R2_ENDPOINT הוא https://<ACCOUNT_ID>.
// r2.cloudflarestorage.com בלבד — בלי שם ה-bucket בסוף; שם ה-bucket
// מועבר בנפרד כפרמטר Bucket בכל קריאה (path-style, לא virtual-hosted).
//
// R2_PUBLIC_URL נפרד לגמרי מ-R2_ENDPOINT: ה-S3 endpoint אינו נגיש
// ב-GET ציבורי (זו נקודת הכתיבה/ניהול, מאומתת בחתימת AWS). קריאה
// ציבורית דורשת bucket עם "Public Development URL" (r2.dev) מופעל
// ידנית בדשבורד של Cloudflare, או custom domain מחובר — שניהם לא
// ניתנים לגזירה מ-ACCOUNT_ID/BUCKET_NAME, ולכן חובה כמשתנה סביבה
// נפרד ולא מחושב.
// ============================================================

const client = new S3Client({
  region: 'auto',
  endpoint: env.R2_ENDPOINT,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});

export async function uploadImage(buffer: Buffer, key: string, contentType: string): Promise<void> {
  await client.send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );
}

export function getPublicUrl(key: string): string {
  return `${env.R2_PUBLIC_URL.replace(/\/+$/, '')}/${key}`;
}

// לניקוי עתידי (למשל כשמנהלת מחליפה תמונה ידנית ורוצה למחוק את
// הקודמת) — לא בשימוש בשום זרימה קיימת עדיין, ראו הנחיית המשימה.
export async function deleteImage(key: string): Promise<void> {
  await client.send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: key }));
}

// עבור בתים שכבר נמצאים ביד (למשל req.file.buffer מ-multer, בזרימת
// העלאה ידנית של לוגו) — לא צריך הורדה מ-URL חיצוני קודם, בשונה
// מ-downloadAndUploadImage. url ריק מועבר ל-guessExtension בכוונה:
// contentType הידוע (multer fileFilter מוודא image/*) מספיק כמעט
// תמיד, ה-URL הוא רק fallback אחרון שם.
export async function uploadImageBuffer(buffer: Buffer, keyPrefix: string, contentType: string): Promise<string> {
  const ext = guessExtension('', contentType);
  const key = `${keyPrefix}.${ext}`;
  await uploadImage(buffer, key, contentType);
  return getPublicUrl(key);
}

export function guessExtension(url: string, contentType?: string): string {
  if (contentType?.includes('png')) return 'png';
  if (contentType?.includes('gif')) return 'gif';
  if (contentType?.includes('webp')) return 'webp';
  if (contentType?.includes('svg')) return 'svg';
  if (contentType?.includes('jpeg') || contentType?.includes('jpg')) return 'jpg';
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase();
  if (ext && /^[a-z0-9]{2,4}$/.test(ext)) return ext;
  return 'jpg';
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // עקבי עם aiEnrichment.service.MAX_IMAGE_BYTES

export type DownloadAndUploadOutcome =
  | { outcome: 'uploaded'; publicUrl: string; sizeBytes: number; contentType: string }
  | { outcome: 'failed'; reason: string };

// מוריד תמונה מ-URL חיצוני ומעלה אותה ל-R2 תחת key נתון — לא זורק
// לעולם (הקורא תמיד מקבל outcome מפורש), כי כשל הורדת תמונה בודדת
// לא אמור להפיל את הקורא (קליטת פריט מהתוסף / חיפוש לוגו). timeoutMs
// ברירת מחדל קצר (5 שניות, לא 10 כמו ב-aiEnrichment) בכוונה: זו
// קריאה שיושבת בתוך זרימת קליטת פריט מהתוסף שרצה בלולאה סינכרונית
// על עשרות פריטים באותה בקשה — timeout ארוך פר-תמונה כפול העלות
// על פני כל הפריטים. חיפוש לוגו (cron, לא חוסם משתמש) יכול להעביר
// timeoutMs ארוך יותר במפורש אם צריך.
export async function downloadAndUploadImage(
  sourceUrl: string,
  key: string,
  timeoutMs = 5000
): Promise<DownloadAndUploadOutcome> {
  try {
    const response = await axios.get<ArrayBuffer>(sourceUrl, {
      responseType: 'arraybuffer',
      timeout: timeoutMs,
      maxContentLength: MAX_IMAGE_BYTES,
      headers: { 'User-Agent': 'BenefitsWalletBot/1.0 (+image-fetch)' },
    });
    const contentType = response.headers['content-type'] as string | undefined;
    if (contentType && !contentType.startsWith('image/') && !contentType.startsWith('application/octet-stream')) {
      return { outcome: 'failed', reason: `Content-Type אינו תמונה: ${contentType}` };
    }
    const buffer = Buffer.from(response.data);
    const ext = guessExtension(sourceUrl, contentType);
    const fullKey = `${key}.${ext}`;
    const finalContentType = contentType?.startsWith('image/') ? contentType : `image/${ext === 'jpg' ? 'jpeg' : ext}`;

    await uploadImage(buffer, fullKey, finalContentType);

    return { outcome: 'uploaded', publicUrl: getPublicUrl(fullKey), sizeBytes: buffer.byteLength, contentType: finalContentType };
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Unknown error';
    logger.warn({ sourceUrl, key, err: reason }, 'downloadAndUploadImage failed');
    return { outcome: 'failed', reason };
  }
}
