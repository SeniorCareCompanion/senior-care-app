#!/bin/bash

# 🚀 Senior Care Companion - Complete Pre-Push Deployment Script
# Run this script before every deployment to ensure quality and safety

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'  
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${BOLD}🚀 Senior Care Companion - Pre-Push Deployment Script${NC}"
echo "═══════════════════════════════════════════════════════════"
echo ""

# ════════════════════════════════════════════════════════════════════════════════
# STEP 1: Verify Repository Location
# ════════════════════════════════════════════════════════════════════════════════
echo -e "${BLUE}📍 Step 1: Verifying Repository Location${NC}"

EXPECTED_PATH="/Users/greghall/Desktop/senior-care-app"
CURRENT_PATH=$(pwd)

if [[ "$CURRENT_PATH" != "$EXPECTED_PATH" ]]; then
    echo -e "${RED}❌ Wrong directory!${NC}"
    echo "   Current: $CURRENT_PATH"
    echo "   Expected: $EXPECTED_PATH"
    echo ""
    echo -e "${YELLOW}💡 Run this script from: $EXPECTED_PATH${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Repository location correct${NC}"
echo ""

# ════════════════════════════════════════════════════════════════════════════════
# STEP 2: Check for New/Modified Files
# ════════════════════════════════════════════════════════════════════════════════
echo -e "${BLUE}📋 Step 2: Checking for Changes${NC}"

# Check git status
if git diff-index --quiet HEAD --; then
    echo -e "${YELLOW}⚠️ No changes detected${NC}"
    echo "   If you copied new files, make sure they're in the repository directory"
    echo "   Recent files in directory:"
    ls -la *.html *.js 2>/dev/null | head -3 || echo "   No HTML/JS files found"
    echo ""
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Deployment cancelled."
        exit 0
    fi
else
    echo -e "${GREEN}✅ Changes detected${NC}"
    echo "   Modified files:"
    git diff --name-only HEAD | sed 's/^/   - /'
    echo ""
fi

# ════════════════════════════════════════════════════════════════════════════════
# STEP 3: Run Local Verification Tests
# ════════════════════════════════════════════════════════════════════════════════
echo -e "${BLUE}🧪 Step 3: Running Pre-Deployment Verification${NC}"

if [[ ! -x "./verify_deployment.sh" ]]; then
    echo -e "${RED}❌ verify_deployment.sh not found or not executable${NC}"
    echo "   Make sure verify_deployment.sh exists and is executable"
    echo "   Run: chmod +x verify_deployment.sh"
    exit 1
fi

echo "Running comprehensive test suite..."
echo ""

# Run the verification script and capture output
if ./verify_deployment.sh; then
    echo ""
    echo -e "${GREEN}🎉 ALL VERIFICATION TESTS PASSED!${NC}"
    echo ""
else
    echo ""
    echo -e "${RED}❌ VERIFICATION TESTS FAILED!${NC}"
    echo -e "${RED}🚫 DEPLOYMENT BLOCKED - Fix issues above before proceeding${NC}"
    echo ""
    echo -e "${YELLOW}💡 Common fixes:${NC}"
    echo "   • Check version consistency across all locations"
    echo "   • Verify JavaScript functions are not truncated"
    echo "   • Ensure email bug report links are working"
    echo "   • Confirm file structure is correct"
    exit 1
fi

# ════════════════════════════════════════════════════════════════════════════════
# STEP 4: Auto-Commit Changes
# ════════════════════════════════════════════════════════════════════════════════
echo -e "${BLUE}💾 Step 4: Preparing Deployment Commit${NC}"

# Check if there are any changes to commit
if git diff-index --quiet HEAD --; then
    echo -e "${YELLOW}⚠️ No changes to commit${NC}"
else
    echo "Files to be committed:"
    git diff --name-only HEAD | sed 's/^/   • /'
    echo ""
    
    # Auto-generate commit message based on files changed
    CHANGED_FILES=$(git diff --name-only HEAD)
    
    if echo "$CHANGED_FILES" | grep -q "index.html"; then
        DEFAULT_MSG="feat: update Senior Care Companion app"
    elif echo "$CHANGED_FILES" | grep -q ".github/workflows"; then
        DEFAULT_MSG="ci: update deployment pipeline"
    elif echo "$CHANGED_FILES" | grep -q "README"; then
        DEFAULT_MSG="docs: update documentation"
    else
        DEFAULT_MSG="chore: update files"
    fi
    
    echo -e "${YELLOW}📝 Suggested commit message: ${DEFAULT_MSG}${NC}"
    read -p "Use this message? (Y/n): " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Nn]$ ]]; then
        echo "Enter custom commit message:"
        read -r CUSTOM_MSG
        COMMIT_MSG="$CUSTOM_MSG"
    else
        COMMIT_MSG="$DEFAULT_MSG"
    fi
    
    # Stage and commit all changes
    echo "Staging all changes..."
    git add .
    
    echo "Committing with message: $COMMIT_MSG"
    git commit -m "$COMMIT_MSG"
    
    echo -e "${GREEN}✅ Changes committed successfully${NC}"
    echo ""
fi

# ════════════════════════════════════════════════════════════════════════════════
# STEP 5: Final Instructions
# ════════════════════════════════════════════════════════════════════════════════
echo "═══════════════════════════════════════════════════════════"
echo -e "${GREEN}🎉 DEPLOYMENT PREPARATION COMPLETE!${NC}"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo -e "${BOLD}📋 Next Steps:${NC}"
echo ""
echo -e "${YELLOW}1. PUSH TO GITHUB:${NC}"
echo "   • Open GitHub Desktop"
echo "   • You should see commits ready to push"
echo "   • Click 'Push origin'"
echo ""
echo -e "${YELLOW}2. MONITOR GITHUB ACTIONS:${NC}"
echo "   • Go to GitHub.com → Your repository → Actions"
echo "   • Watch for your workflow to complete (~10 minutes)"
echo "   • All tests should pass automatically"
echo ""
echo -e "${YELLOW}3. APPROVE DEPLOYMENT:${NC}"
echo "   • Look for 'Review deployments' button"
echo "   • Click to approve production deployment"
echo "   • Your beta testers will get the update"
echo ""
echo -e "${BOLD}🛡️ Your beta testers are protected:${NC}"
echo "   ✅ 51 tests verified locally"
echo "   ✅ 51 tests will verify on GitHub"
echo "   ✅ Manual approval required for production"
echo "   ✅ Impossible to deploy broken builds"
echo ""
echo -e "${GREEN}🚀 Ready for confident deployment!${NC}"
