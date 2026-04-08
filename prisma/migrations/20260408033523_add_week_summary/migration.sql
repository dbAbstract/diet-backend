-- CreateEnum
CREATE TYPE "WeekStatus" AS ENUM ('PENDING_REVIEW', 'FINALIZED');

-- CreateTable
CREATE TABLE "WeekSummary" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "status" "WeekStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "calorieTarget" INTEGER NOT NULL,
    "nextWeekTarget" INTEGER,
    "avgKcal" DOUBLE PRECISION,
    "avgWeight" DOUBLE PRECISION,
    "adherentDays" INTEGER,
    "adherencePct" DOUBLE PRECISION,
    "weightDelta" DOUBLE PRECISION,
    "expectedDelta" DOUBLE PRECISION,
    "aiInsight" TEXT,
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeekSummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WeekSummary_userId_weekStart_key" ON "WeekSummary"("userId", "weekStart");

-- AddForeignKey
ALTER TABLE "WeekSummary" ADD CONSTRAINT "WeekSummary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
