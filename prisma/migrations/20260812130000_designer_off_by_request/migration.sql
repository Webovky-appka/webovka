-- Designer se na přání majitele studia vypíná i na produkci. DO NOTHING:
-- jakmile ho někdo zapne tlačítkem, migrace už do stavu nemluví.
INSERT INTO "SalesConfig" ("id", "designerEnabled", "updatedAt")
VALUES ('sales', false, NOW())
ON CONFLICT ("id") DO NOTHING;
