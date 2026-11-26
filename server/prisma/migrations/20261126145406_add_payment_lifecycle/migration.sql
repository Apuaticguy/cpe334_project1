-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PAID', 'REFUNDED');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "paymentReference" TEXT,
ADD COLUMN     "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID';
