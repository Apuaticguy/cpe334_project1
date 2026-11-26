-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'REJECTED';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "rejectionReason" TEXT;
