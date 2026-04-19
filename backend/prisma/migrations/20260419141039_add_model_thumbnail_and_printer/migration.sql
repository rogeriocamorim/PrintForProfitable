-- AlterTable
ALTER TABLE "models_3d" ADD COLUMN     "printerId" TEXT,
ADD COLUMN     "thumbnailPath" TEXT;

-- AddForeignKey
ALTER TABLE "models_3d" ADD CONSTRAINT "models_3d_printerId_fkey" FOREIGN KEY ("printerId") REFERENCES "printers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
