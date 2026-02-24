#!/bin/bash

# 🚀 Senior Care Companion - Quick Daily Deployment
# Simple script for regular deployments

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "🚀 Senior Care Companion - Quick Deploy"
echo "════════════════════════════════════════"

# Quick verification
if ./verify_deployment.sh > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Tests passed!${NC}"
    
    # Auto-commit if changes exist
    if ! git diff-index --quiet HEAD --; then
        git add .
        git commit -m "feat: ready for deployment - $(date '+%Y-%m-%d %H:%M')"
        echo -e "${GREEN}✅ Changes committed${NC}"
    else
        echo -e "${YELLOW}⚠️ No changes to commit${NC}"
    fi
    
    echo ""
    echo -e "${YELLOW}📱 Next: Push via GitHub Desktop, then approve in Actions${NC}"
else
    echo -e "${RED}❌ Tests failed - check issues and try again${NC}"
    exit 1
fi
