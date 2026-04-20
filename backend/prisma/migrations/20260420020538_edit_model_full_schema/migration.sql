-- AlterTable
ALTER TABLE "models_3d" ADD COLUMN     "buildPlateQty" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "category" TEXT,
ADD COLUMN     "designer" TEXT,
ADD COLUMN     "hasPersonalization" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasVariations" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "imagePath" TEXT,
ADD COLUMN     "marketplaceName" TEXT,
ADD COLUMN     "postCostPerHour" DOUBLE PRECISION,
ADD COLUMN     "postTimeMinutes" DOUBLE PRECISION NOT NULL DEFAULT 1,
ADD COLUMN     "prepCostPerHour" DOUBLE PRECISION,
ADD COLUMN     "prepTimeMinutes" DOUBLE PRECISION NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "model_skus" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,

    CONSTRAINT "model_skus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_parts" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Plate 1',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "model_parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_part_filaments" (
    "id" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filamentId" TEXT,
    "grams" DOUBLE PRECISION NOT NULL,
    "totalCost" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "model_part_filaments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_supplies" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "model_supplies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_platform_assignments" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "platformId" TEXT NOT NULL,
    "shippingProfileId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "model_platform_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "model_platform_assignments_modelId_platformId_key" ON "model_platform_assignments"("modelId", "platformId");

-- AddForeignKey
ALTER TABLE "model_skus" ADD CONSTRAINT "model_skus_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "models_3d"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_parts" ADD CONSTRAINT "model_parts_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "models_3d"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_part_filaments" ADD CONSTRAINT "model_part_filaments_partId_fkey" FOREIGN KEY ("partId") REFERENCES "model_parts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_part_filaments" ADD CONSTRAINT "model_part_filaments_filamentId_fkey" FOREIGN KEY ("filamentId") REFERENCES "filaments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_supplies" ADD CONSTRAINT "model_supplies_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "models_3d"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_platform_assignments" ADD CONSTRAINT "model_platform_assignments_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "models_3d"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_platform_assignments" ADD CONSTRAINT "model_platform_assignments_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "sales_platforms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_platform_assignments" ADD CONSTRAINT "model_platform_assignments_shippingProfileId_fkey" FOREIGN KEY ("shippingProfileId") REFERENCES "shipping_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
