# Benefits Wallet — ארנק ההטבות החכם

הפרויקט מורכב משלוש אפליקציות נפרדות, שכל אחת נמצאת בתיקייה משלה תחת `apps/`:

## `apps/backend/`
השרת המרכזי — כאן נשמר כל המידע (הטבות, מועדונים, מותגים וכו') וכאן קורית כל הלוגיקה. גם הדשבורד וגם האפליקציה מדברות איתו.
**להסבר מפורט על כל קובץ: `apps/backend/README.md`**

## `apps/dashboard/`
ממשק הניהול — כאן מנהלת המערכת מוסיפה ומעדכנת מועדונים, הטבות, מותגים, ומאשרת מקורות סריקה, בלי לגעת בקוד.
**להסבר מפורט על כל קובץ: `apps/dashboard/README.md`**

## `apps/mobile/`
אפליקציית הטלפון — כאן המשתמשת הסופית רואה ובוחרת את ההטבות שלה.
**להסבר מפורט על כל קובץ: `apps/mobile/README.md`**

---

## סדר הפעלה מומלץ

1. **Backend** — `cd apps/backend && npm install`, הגדירי `.env` עם `DATABASE_URL` לפוסטגרס אמיתי, ואז `npx prisma generate && npx prisma migrate dev && npx prisma db seed && npm run dev`.
2. **Dashboard** — `cd apps/dashboard && npm install && npm run dev` (בטרמינל נפרד, כשהשרת כבר רץ).
3. **Mobile** — `cd apps/mobile && npm install && npx expo start` (בטרמינל נפרד, כשהשרת כבר רץ).

כל שלושת האפליקציות מצפות שהשרת ירוץ על `http://localhost:4000` כברירת מחדל.
