-- Add thumbnail support for processed videos
ALTER TABLE "Video"
ADD COLUMN "thumbnailKey" TEXT;
