#!/bin/bash

# 🚀 Senior Care Companion - Deployment System Setup
# Run this once to set up your deployment pipeline

echo "🚀 Senior Care Companion - Deployment System Setup"
echo "═══════════════════════════════════════════════════"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'  
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ════════════════════════════════════════════════════════════════════════════════
# STEP 1: Verify Prerequisites  
# ════════════════════════════════════════════════════════════════════════════════
echo -e "${BLUE}📋 Step 1: Checking Prerequisites${NC}"

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    echo -e "${RED}❌ Not a git repository!${NC}"
    echo "Please run this from your Senior Care Companion repository root."
    exit 1
fi
echo -e "${GREEN}✅ Git repository detected${NC}"

# Check if index.html exists
if [ ! -f "index.html" ]; then
    echo -e "${RED}❌ index.html not found!${NC}"
    echo "Please make sure index.html is in the repository root."
    exit 1
fi
echo -e "${GREEN}✅ index.html found${NC}"

# Check if test file exists
if [ ! -f "tests/test_senior_care_app.py" ]; then
    echo -e "${YELLOW}⚠️ Test file not found - creating tests directory${NC}"
    mkdir -p tests
    echo "Please copy test_senior_care_app.py to the tests/ directory."
else
    echo -e "${GREEN}✅ Test file found${NC}"
fi

echo ""

# ════════════════════════════════════════════════════════════════════════════════
# STEP 2: Set Up File Permissions
# ════════════════════════════════════════════════════════════════════════════════
echo -e "${BLUE}🔧 Step 2: Setting Up File Permissions${NC}"

# Make verification script executable
if [ -f "verify_deployment.sh" ]; then
    chmod +x verify_deployment.sh
    echo -e "${GREEN}✅ verify_deployment.sh made executable${NC}"
else
    echo -e "${YELLOW}⚠️ verify_deployment.sh not found${NC}"
fi

echo ""

# ════════════════════════════════════════════════════════════════════════════════
# STEP 3: Create Directory Structure
# ════════════════════════════════════════════════════════════════════════════════
echo -e "${BLUE}📁 Step 3: Creating Directory Structure${NC}"

# Create .github/workflows directory if it doesn't exist
mkdir -p .github/workflows
echo -e "${GREEN}✅ .github/workflows/ directory ready${NC}"

# Create tests directory if it doesn't exist  
mkdir -p tests
echo -e "${GREEN}✅ tests/ directory ready${NC}"

echo ""

# ════════════════════════════════════════════════════════════════════════════════
# STEP 4: Verify Current Branch Setup
# ════════════════════════════════════════════════════════════════════════════════
echo -e "${BLUE}🌳 Step 4: Branch Setup Verification${NC}"

current_branch=$(git branch --show-current 2>/dev/null || echo "unknown")
echo -e "${GREEN}✅ Current branch: $current_branch${NC}"

# Check if develop branch exists
if git show-ref --verify --quiet refs/heads/develop; then
    echo -e "${GREEN}✅ develop branch exists${NC}"
else
    echo -e "${YELLOW}⚠️ develop branch not found${NC}"
    echo "   Creating develop branch from current branch..."
    git checkout -b develop
    echo -e "${GREEN}✅ develop branch created${NC}"
fi

# Check if main branch exists
if git show-ref --verify --quiet refs/heads/main; then
    echo -e "${GREEN}✅ main branch exists${NC}"
else
    if git show-ref --verify --quiet refs/heads/master; then
        echo -e "${YELLOW}⚠️ Using master branch (consider renaming to main)${NC}"
    else
        echo -e "${RED}❌ No main/master branch found${NC}"
    fi
fi

echo ""

# ════════════════════════════════════════════════════════════════════════════════
# STEP 5: Test the Verification Script
# ════════════════════════════════════════════════════════════════════════════════
echo -e "${BLUE}🧪 Step 5: Testing Verification Script${NC}"

if [ -f "verify_deployment.sh" ]; then
    echo "Running deployment verification test..."
    if ./verify_deployment.sh > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Deployment verification test passed${NC}"
    else
        echo -e "${YELLOW}⚠️ Deployment verification found issues${NC}"
        echo "   Run './verify_deployment.sh' to see details"
    fi
else
    echo -e "${YELLOW}⚠️ Deployment verification script not found${NC}"
fi

echo ""

# ════════════════════════════════════════════════════════════════════════════════
# STEP 6: Instructions for GitHub Setup
# ════════════════════════════════════════════════════════════════════════════════
echo "═══════════════════════════════════════════════════════"
echo -e "${GREEN}🎉 LOCAL SETUP COMPLETE!${NC}"
echo "═══════════════════════════════════════════════════════"
echo ""
echo -e "${BLUE}📋 NEXT STEPS - GitHub Repository Setup:${NC}"
echo ""
echo -e "${YELLOW}1. Push files to GitHub:${NC}"
echo "   git add ."
echo "   git commit -m 'feat: add deployment pipeline'"  
echo "   git push origin develop"
echo ""
echo -e "${YELLOW}2. Set up Branch Protection (GitHub Settings → Branches):${NC}"
echo "   ✅ Protect 'main' branch"
echo "   ✅ Require pull request reviews"  
echo "   ✅ Require status checks to pass:"
echo "      - Quality Assurance Tests"
echo "      - Critical Safety Checks"
echo ""
echo -e "${YELLOW}3. Create Environments (GitHub Settings → Environments):${NC}"
echo "   🚧 'staging' environment (no approval needed)"
echo "   🚀 'production' environment (require your approval)"
echo ""
echo -e "${YELLOW}4. Test the Pipeline:${NC}"
echo "   ./verify_deployment.sh    # Test locally first"
echo "   git push origin develop    # Trigger GitHub Actions"
echo ""
echo -e "${BLUE}📚 Documentation Available:${NC}"
echo "   📖 DEPLOYMENT_STRATEGY.md  - Complete setup guide"
echo "   🚀 DEPLOYMENT_README.md    - Quick reference"
echo ""
echo -e "${GREEN}🛡️ Your beta testers are now protected from broken builds!${NC}"
echo -e "${GREEN}🎯 Deploy with confidence - every build is automatically tested!${NC}"
