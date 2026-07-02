#!/bin/bash
cd /home/adityachandel/projects/LMS/api
export NUM_RUNS=3
npx ts-node -r tsconfig-paths/register ../scripts/workflows/properties/course-draft-status.property.ts 2>&1
echo "EXIT_CODE=$?"
