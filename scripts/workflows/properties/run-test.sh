#!/bin/bash
cd /home/adityachandel/projects/LMS/api
npx ts-node -r tsconfig-paths/register ../scripts/workflows/properties/course-creation-draft.property.ts 2>&1
echo "EXIT_CODE=$?"
