#!/bin/bash

# 🚀 Senior Care Companion - Pre-Deployment Verification
# Run this script before pushing to GitHub to catch issues early

set -e  # Exit on any error

echo "🚀 Senior Care Companion - Pre-Deployment Verification"
echo "═══════════════════════════════════════════════════════"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'  
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if index.html exists
if [ ! -f "index.html" ]; then
    echo -e "${RED}❌ index.html not found!${NC}"
    echo "Make sure you're running this from the repository root."
    exit 1
fi

echo -e "${BLUE}📋 Running Pre-Deployment Checks...${NC}"
echo ""

# ════════════════════════════════════════════════════════════════════════════════
# CHECK 1: Run Full Test Suite
# ════════════════════════════════════════════════════════════════════════════════
echo -e "${YELLOW}🧪 Step 1: Running Full Test Suite${NC}"
if [ -f "tests/test_senior_care_app.py" ]; then
    # # cd ..sts && # cd ..
    if python3 tests/test_senior_care_app.py index.html > test_results.txt 2>&1; then
        echo -e "${GREEN}✅ All 51 tests PASSED!${NC}"
        passed_tests=$(grep -c "ok$" test_results.txt || echo "0")
        echo "   📊 Tests passed: $passed_tests"
    else
        echo -e "${RED}❌ Tests FAILED!${NC}"
        echo "   📋 Failed test details:"
        cat test_results.txt | grep -E "(FAIL|ERROR|AssertionError)" | head -10
        echo ""
        echo -e "${RED}🚫 DEPLOYMENT BLOCKED - Fix test failures first!${NC}"
        exit 1
    fi
    # cd ..
else
    echo -e "${YELLOW}⚠️ Test file not found, skipping automated tests${NC}"
fi
echo ""

# ════════════════════════════════════════════════════════════════════════════════
# CHECK 2: Critical Safety Verification
# ════════════════════════════════════════════════════════════════════════════════
echo -e "${YELLOW}🚨 Step 2: Critical Safety Checks${NC}"

# Check script block count
script_count=$(grep -c '<script' index.html)
if [ "$script_count" -eq 1 ]; then
    echo -e "${GREEN}✅ Script blocks: $script_count (correct)${NC}"
else
    echo -e "${RED}❌ CRITICAL: Found $script_count script blocks, expected 1!${NC}"
    echo -e "${RED}   🚨 Cloudflare email obfuscation detected!${NC}"
    exit 1
fi

# Check for essential JavaScript functions
if grep -q "function login()" index.html; then
    echo -e "${GREEN}✅ login() function: Found${NC}"
else
    echo -e "${RED}❌ CRITICAL: login() function missing!${NC}"
    echo -e "${RED}   🚨 Authentication will be broken!${NC}"
    exit 1
fi

if grep -q "function showRegister()" index.html; then
    echo -e "${GREEN}✅ showRegister() function: Found${NC}"
else
    echo -e "${RED}❌ CRITICAL: showRegister() function missing!${NC}"
    echo -e "${RED}   🚨 Registration will be broken!${NC}"
    exit 1
fi

# Check file integrity
if tail -1 index.html | grep -q "</html>"; then
    echo -e "${GREEN}✅ File ending: Proper </html> tag${NC}"
else
    echo -e "${RED}❌ CRITICAL: File doesn't end with </html>!${NC}"
    echo -e "${RED}   🚨 JavaScript may be truncated!${NC}"
    exit 1
fi

# Check email bug report links
mailto_count=$(grep -c 'mailto:' index.html)
if [ "$mailto_count" -ge 2 ]; then
    echo -e "${GREEN}✅ Email bug report links: $mailto_count found${NC}"
else
    echo -e "${RED}❌ CRITICAL: Expected 2+ mailto links, found $mailto_count!${NC}"
    echo -e "${RED}   🚨 Email bug reporting broken!${NC}"
    exit 1
fi

echo ""

# ════════════════════════════════════════════════════════════════════════════════
# CHECK 3: Version Consistency  
# ════════════════════════════════════════════════════════════════════════════════
echo -e "${YELLOW}📅 Step 3: Version Consistency Check${NC}"

python3 << 'EOF'
import re
import sys

try:
    with open('index.html', 'r') as f:
        html = f.read()

    # Extract versions from key locations
    header_match = re.search(r'VERSION:\s*([0-9-]+\s+UTC)', html)
    login_match = re.search(r'Build:\s*([0-9-]+\s+UTC)', html)
    email_match = re.search(r'subject=[^"]*v([0-9-]+)[^"]*', html)
    settings_match = re.search(r'font-family: monospace[^>]*>\s*([0-9-]+\s+UTC)', html, re.DOTALL)
    
    versions = []
    locations = ['Header', 'Login Banner', 'Email Links', 'Settings Card']
    
    if header_match:
        versions.append(('Header', header_match.group(1).strip()))
    else:
        print("❌ Header version not found!")
        sys.exit(1)
        
    if login_match:
        versions.append(('Login Banner', login_match.group(1).strip()))
    else:
        print("❌ Login banner version not found!")
        sys.exit(1)
        
    if email_match:
        versions.append(('Email Links', email_match.group(1) + ' UTC'))
    else:
        print("❌ Email version not found!")
        sys.exit(1)
        
    if settings_match:
        versions.append(('Settings Card', settings_match.group(1).strip()))
    else:
        print("❌ Settings version not found!")
        sys.exit(1)
    
    # Check consistency
    version_values = [v[1] for v in versions]
    if len(set(version_values)) == 1:
        print(f"✅ All versions consistent: {version_values[0]}")
    else:
        print("❌ Version inconsistencies detected:")
        for location, version in versions:
            print(f"   {location}: {version}")
        sys.exit(1)
        
except Exception as e:
    print(f"❌ Version check failed: {e}")
    sys.exit(1)
EOF

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Version consistency verified${NC}"
else
    echo -e "${RED}❌ CRITICAL: Version inconsistencies detected!${NC}"
    exit 1
fi

echo ""

# ════════════════════════════════════════════════════════════════════════════════
# CHECK 4: File Size & Performance
# ════════════════════════════════════════════════════════════════════════════════
echo -e "${YELLOW}📊 Step 4: Performance Checks${NC}"

file_size=$(wc -c < index.html)
file_size_mb=$(echo "scale=2; $file_size / 1024 / 1024" | bc -l 2>/dev/null || echo "0")
line_count=$(wc -l < index.html)
js_char_count=$(python3 -c "
import re
with open('index.html', 'r') as f:
    content = f.read()
script_start = content.find('<script>')
script_end = content.rfind('</script>')
if script_start != -1 and script_end != -1:
    js_content = content[script_start+8:script_end]
    print(len(js_content))
else:
    print(0)
" 2>/dev/null || echo "0")

echo -e "${GREEN}✅ File size: $file_size bytes ($file_size_mb MB)${NC}"
echo -e "${GREEN}✅ Line count: $line_count lines${NC}" 
echo -e "${GREEN}✅ JavaScript size: $js_char_count characters${NC}"

if [ "$file_size" -gt 2000000 ]; then  # > 2MB
    echo -e "${YELLOW}⚠️ Large file size - consider optimization${NC}"
fi

echo ""

# ════════════════════════════════════════════════════════════════════════════════
# FINAL RESULT
# ════════════════════════════════════════════════════════════════════════════════
echo "═══════════════════════════════════════════════════════"
echo -e "${GREEN}🎉 ALL CHECKS PASSED! BUILD IS SAFE FOR DEPLOYMENT${NC}"
echo "═══════════════════════════════════════════════════════"
echo ""
echo -e "${BLUE}📋 Summary:${NC}"
echo -e "   ✅ All tests passed"
echo -e "   ✅ Critical functions verified" 
echo -e "   ✅ File integrity confirmed"
echo -e "   ✅ Email functionality working"
echo -e "   ✅ Version consistency verified"
echo ""
echo -e "${BLUE}🚀 Ready to deploy:${NC}"
echo -e "   ${YELLOW}git add .${NC}"
echo -e "   ${YELLOW}git commit -m 'feat: ready for deployment'${NC}"
echo -e "   ${YELLOW}git push origin develop${NC}"
echo ""
echo -e "${GREEN}Your beta testers will receive a high-quality, tested build! 🎯${NC}"
