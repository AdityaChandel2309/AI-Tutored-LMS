-- AlterTable
ALTER TABLE "AssessmentAttempt" ADD COLUMN     "durationSec" INTEGER;

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;
