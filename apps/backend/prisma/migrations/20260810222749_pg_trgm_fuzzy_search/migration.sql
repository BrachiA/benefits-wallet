-- חיפוש חכם (שלב 6): עמידות לשגיאות כתיב, לפי pg_trgm.
--
-- CREATE EXTENSION דורש הרשאה מתאימה במסד הנתונים. בסביבת פיתוח
-- מקומית (superuser) זה עובד ישירות; בענן מנוהל (RDS/Cloud SQL
-- וכו') יש לוודא מראש שההרשאה קיימת, או להפעיל את ה-extension
-- דרך קונסולת הספק לפני שמריצים מיגרציה זו — ראו את הדוח.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- אינדקסי GIN לחיפוש trigram מהיר. בלעדיהם similarity()/ILIKE '%..%'
-- עדיין עובדים נכון, רק כ-sequential scan — קביל בקנה מידה קטן,
-- אך האינדקס הופך אותו לישים גם עם קטלוג גדול.
CREATE INDEX IF NOT EXISTS brands_name_trgm_idx ON brands USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS brands_name_en_trgm_idx ON brands USING GIN ("nameEn" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS categories_name_trgm_idx ON categories USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS categories_name_en_trgm_idx ON categories USING GIN ("nameEn" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS benefits_title_trgm_idx ON benefits USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS benefits_short_desc_trgm_idx ON benefits USING GIN ("shortDescription" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS programs_name_trgm_idx ON programs USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS stores_name_trgm_idx ON stores USING GIN (name gin_trgm_ops);