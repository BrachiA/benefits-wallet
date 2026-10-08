import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';

import { authRouter } from './modules/auth/auth.routes';
import { issuerRouter } from './modules/issuer/issuer.routes';
import { programRouter } from './modules/program/program.routes';
import { categoryRouter } from './modules/category/category.routes';
import { brandRouter } from './modules/brand/brand.routes';
import { storeRouter } from './modules/store/store.routes';
import { benefitRouter } from './modules/benefit/benefit.routes';
import { couponRouter } from './modules/coupon/coupon.routes';
import { campaignRouter } from './modules/campaign/campaign.routes';
import { tagRouter } from './modules/tag/tag.routes';
import { scraperRouter } from './modules/scraper/scraper.routes';
import { searchRouter } from './modules/search/search.routes';
import { recommendationRouter } from './modules/recommendation/recommendation.routes';
import { settingsRouter } from './modules/settings/settings.routes';
import { duplicateCleanupRouter } from './modules/duplicateCleanup/duplicateCleanup.routes';
import { aiEnrichmentRouter } from './modules/aiEnrichment/aiEnrichment.routes';

// app.ts מרכיב את Express בלבד ולא קורא ל-listen() — server.ts הוא
// היחיד שעושה זאת. ההפרדה הזו קריטית לבדיקות: אפשר לייבא { app }
// ולהריץ נגדו supertest בלי לפתוח פורט TCP אמיתי בכל טסט.
export const app = express();

app.use(helmet());
app.use(
  cors({
    // origin:true (ולא '*') כדי לשקף את המקור המבקש בפועל — cookie
    // עם credentials לא נשלח כשה-CORS מרשה '*' במפורש. כשמוגדרת
    // רשימה סגורה ב-CORS_ORIGINS, נאכפת רק היא.
    origin: env.CORS_ORIGINS === '*' ? true : env.CORS_ORIGINS.split(','),
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
app.use(requestLogger);

app.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

// /api/v1 מההתחלה: response shape יציב לאורך הגרסה.
// הגנת ההתחברות (requireAdminAuth) מוחלת בתוך כל *.routes.ts בנפרד
// על נתיבי כתיבה/ניהול בלבד — קריאות GET שהאפליקציה צורכת נשארות
// פתוחות. authRouter עצמו (login/logout/me) חייב להישאר ציבורי.
const v1 = express.Router();
v1.use('/auth', authRouter);
v1.use('/issuers', issuerRouter);
v1.use('/programs', programRouter);
v1.use('/categories', categoryRouter);
v1.use('/brands', brandRouter);
v1.use('/stores', storeRouter);
v1.use('/benefits', benefitRouter);
v1.use('/coupons', couponRouter);
v1.use('/campaigns', campaignRouter);
v1.use('/tags', tagRouter);
v1.use('/scraper', scraperRouter);
v1.use('/search', searchRouter);
v1.use('/recommendations', recommendationRouter);
v1.use('/settings', settingsRouter);
v1.use('/duplicate-cleanup', duplicateCleanupRouter);
v1.use('/ai-enrichment', aiEnrichmentRouter);

app.use('/api/v1', v1);

// חייבים לבוא אחרונים: notFound תופס כל route שלא נתפס למעלה,
// errorHandler הוא ה-middleware בעל 4 הפרמטרים היחיד באפליקציה
// (Express מזהה אותו ככזה לפי החתימה, לא לפי המיקום — אך הסדר
// עדיין קובע איזו שגיאה הוא בכלל יראה).
app.use(notFound);
app.use(errorHandler);
