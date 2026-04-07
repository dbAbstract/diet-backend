/*
  Warnings:

  - You are about to drop the column `targetCalories` on the `User` table. All the data in the column will be lost.
  - Added the required column `dailyDeficitKcal` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sex` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `targetWeightKg` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('MALE', 'FEMALE');

-- AlterTable
ALTER TABLE "User" DROP COLUMN "targetCalories",
ADD COLUMN     "dailyDeficitKcal" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "sex" "Sex" NOT NULL,
ADD COLUMN     "targetWeightKg" DOUBLE PRECISION NOT NULL;

-- AlterTable
ALTER TABLE "WeightEntry" ADD COLUMN     "bodyFatPct" DOUBLE PRECISION;
