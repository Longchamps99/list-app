-- AlterTable: Add forkedFromId to List
ALTER TABLE "List" ADD COLUMN "forkedFromId" TEXT;

-- AlterTable: Add status to Item
ALTER TABLE "Item" ADD COLUMN "status" TEXT;

-- AlterTable: Add permission to SharedList
ALTER TABLE "SharedList" ADD COLUMN "permission" TEXT NOT NULL DEFAULT 'WRITE';

-- AddForeignKey: List.forkedFromId -> List.id
ALTER TABLE "List" ADD CONSTRAINT "List_forkedFromId_fkey" FOREIGN KEY ("forkedFromId") REFERENCES "List"("id") ON DELETE SET NULL ON UPDATE CASCADE;
