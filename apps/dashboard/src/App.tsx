import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/layout/Layout';

import { IssuersListPage } from './pages/Issuers/IssuersListPage';
import { IssuerFormPage } from './pages/Issuers/IssuerFormPage';
import { ProgramsListPage } from './pages/Programs/ProgramsListPage';
import { ProgramFormPage } from './pages/Programs/ProgramFormPage';
import { CategoriesListPage } from './pages/Categories/CategoriesListPage';
import { CategoryFormPage } from './pages/Categories/CategoryFormPage';
import { BrandsListPage } from './pages/Brands/BrandsListPage';
import { BrandFormPage } from './pages/Brands/BrandFormPage';
import { StoresListPage } from './pages/Stores/StoresListPage';
import { StoreFormPage } from './pages/Stores/StoreFormPage';
import { BenefitsListPage } from './pages/Benefits/BenefitsListPage';
import { BenefitFormPage } from './pages/Benefits/BenefitFormPage';
import { CouponsListPage } from './pages/Coupons/CouponsListPage';
import { CouponFormPage } from './pages/Coupons/CouponFormPage';
import { CampaignsListPage } from './pages/Campaigns/CampaignsListPage';
import { CampaignFormPage } from './pages/Campaigns/CampaignFormPage';
import { TagsListPage } from './pages/Tags/TagsListPage';
import { TagFormPage } from './pages/Tags/TagFormPage';
import { ScraperSourcesListPage } from './pages/ScraperSources/ScraperSourcesListPage';
import { ScraperSourceFormPage } from './pages/ScraperSources/ScraperSourceFormPage';
import { ScrapedItemsListPage } from './pages/ScrapedItems/ScrapedItemsListPage';
import { ScrapedItemReviewPage } from './pages/ScrapedItems/ScrapedItemReviewPage';

// כל ישות: /entity (רשימה) + /entity/:id (עריכה, "new" ליצירה).
// ScrapedItem הוא היוצא מן הכלל היחיד — אין לו מסך יצירה ידני,
// כי הוא נוצר רק דרך הסורק, לכן /scraped-items/:id הוא Review בלבד.
export function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/benefits" replace />} />

          <Route path="/issuers" element={<IssuersListPage />} />
          <Route path="/issuers/:id" element={<IssuerFormPage />} />

          <Route path="/programs" element={<ProgramsListPage />} />
          <Route path="/programs/:id" element={<ProgramFormPage />} />

          <Route path="/categories" element={<CategoriesListPage />} />
          <Route path="/categories/:id" element={<CategoryFormPage />} />

          <Route path="/brands" element={<BrandsListPage />} />
          <Route path="/brands/:id" element={<BrandFormPage />} />

          <Route path="/stores" element={<StoresListPage />} />
          <Route path="/stores/:id" element={<StoreFormPage />} />

          <Route path="/benefits" element={<BenefitsListPage />} />
          <Route path="/benefits/:id" element={<BenefitFormPage />} />

          <Route path="/coupons" element={<CouponsListPage />} />
          <Route path="/coupons/:id" element={<CouponFormPage />} />

          <Route path="/campaigns" element={<CampaignsListPage />} />
          <Route path="/campaigns/:id" element={<CampaignFormPage />} />

          <Route path="/tags" element={<TagsListPage />} />
          <Route path="/tags/:id" element={<TagFormPage />} />

          <Route path="/scraper-sources" element={<ScraperSourcesListPage />} />
          <Route path="/scraper-sources/:id" element={<ScraperSourceFormPage />} />

          <Route path="/scraped-items" element={<ScrapedItemsListPage />} />
          <Route path="/scraped-items/:id" element={<ScrapedItemReviewPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
