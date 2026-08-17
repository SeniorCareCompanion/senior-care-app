#!/usr/bin/env python3
"""
Auto-Update Build Version Script
Updates version timestamp to current date/time in YYYY-MM-DD-HHMM UTC format
Usage: python3 update_build.py
"""

import re
from datetime import datetime

def update_build_version(filename='index.html'):
    """
    Updates the build version in index.html to current date/time
    Format: YYYY-MM-DD-HHMM UTC (e.g., 2026-04-15-1845 UTC)
    """
    
    # Read the file
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Get current date and time in UTC
    now = datetime.utcnow()
    date_str = now.strftime('%Y-%m-%d')
    time_str = now.strftime('%H%M')
    new_version = f"{date_str}-{time_str}"
    timestamp = now.strftime('%B %d, %Y at %H:%M %p UTC')
    
    print(f"📅 Current Date: {date_str}")
    print(f"⏰ Current Time: {time_str}")
    print(f"✅ New Version: {new_version} UTC")
    print(f"⏰ Timestamp: {timestamp}\n")
    
    # Find current version in header comment
    version_match = re.search(r'VERSION: (\d{4}-\d{2}-\d{2}-\d{4})', content)
    if version_match:
        old_version = version_match.group(1)
        print(f"📌 Old Version: {old_version}")
    else:
        print("⚠️  Warning: Could not find old VERSION in header")
    
    # ════════════════════════════════════════════════════════════════
    # 1. Update VERSION in header comment
    # ════════════════════════════════════════════════════════════════
    content = re.sub(
        r'VERSION: \d{4}-\d{2}-\d{2}-\d{4}',
        f'VERSION: {new_version}',
        content,
        count=1
    )
    print("  ✓ Updated VERSION in header comment")
    
    # ════════════════════════════════════════════════════════════════
    # 2. Update Build display box (┌─────┐ style)
    # ════════════════════════════════════════════════════════════════
    content = re.sub(
        r'Build: \d{4}-\d{2}-\d{2}-\d{4} UTC',
        f'Build: {new_version} UTC',
        content
    )
    print("  ✓ Updated Build display box")
    
    # ════════════════════════════════════════════════════════════════
    # 3. Update CACHE-BUSTING TIMESTAMP comment
    # ════════════════════════════════════════════════════════════════
    content = re.sub(
        r'CACHE-BUSTING TIMESTAMP: \d{4}-\d{2}-\d{2}-\d{4}',
        f'CACHE-BUSTING TIMESTAMP: {new_version}',
        content
    )
    print("  ✓ Updated cache-busting timestamp")
    
    # ════════════════════════════════════════════════════════════════
    # 4. Update Release Notes version heading
    # ════════════════════════════════════════════════════════════════
    content = re.sub(
        r'Version \d{4}-\d{2}-\d{2}-\d{4} UTC</h4>',
        f'Version {new_version} UTC</h4>',
        content
    )
    print("  ✓ Updated Release Notes heading")
    
    # ════════════════════════════════════════════════════════════════
    # 5. Update Settings page App Version card (MOST IMPORTANT)
    # Look specifically within the settingsCard-appVersion div
    # ════════════════════════════════════════════════════════════════
    settings_version_pattern = (
        r'(id="settingsCard-appVersion"[^>]*>.*?'
        r'<p[^>]*font-family: monospace[^>]*>\s*)'
        r'\d{4}-\d{2}-\d{2}-\d{4}'
        r'(\s*</p>)'
    )
    content = re.sub(
        settings_version_pattern,
        r'\1' + new_version + r'\2',
        content,
        flags=re.DOTALL
    )
    print("  ✓ Updated Settings App Version card")
    
    # ════════════════════════════════════════════════════════════════
    # 6. Update console.log version display
    # ════════════════════════════════════════════════════════════════
    content = re.sub(
        r"🏷️ CURRENT VERSION: \d{4}-\d{2}-\d{2}-\d{4} UTC",
        f'🏷️ CURRENT VERSION: {new_version} UTC',
        content
    )
    print("  ✓ Updated console.log version")
    
    # Write the file back
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"\n✅ Successfully updated build version!")
    print(f"📝 File: {filename}")
    print(f"🔄 New version: {new_version} UTC")
    print(f"\n🚀 Ready to deploy!")
    
    return True

if __name__ == '__main__':
    try:
        success = update_build_version()
        exit(0 if success else 1)
    except Exception as e:
        print(f"❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        exit(1)
