-- Designer: koncept nové homepage do přílohy + experiment mockup/kontrola
ALTER TABLE "SalesLead" ADD COLUMN "mockupVariant" TEXT;
ALTER TABLE "SalesLead" ADD COLUMN "mockupKey" TEXT;
ALTER TABLE "SalesLead" ADD COLUMN "mockupAt" TIMESTAMP(3);
