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
    
    print(f"📅 Current Date: {date_str}")
    print(f"⏰ Current Time: {time_str}")
    print(f"✅ New Version: {new_version} UTC\n")
    
    # Find current version in header comment
    version_match = re.search(r'VERSION: (\d{4}-\d{2}-\d{2}-\d{4})', content)
    if version_match:
        old_version = version_match.group(1)
        print(f"📌 Old Version: {old_version}")
    
    # ════════════════════════════════════════════════════════════════
    # Update ALL occurrences of YYYY-MM-DD-HHMM pattern
    # This will catch: header, build box, cache timestamp, release notes,
    # settings card, and console.log all at once
    # ════════════════════════════════════════════════════════════════
    
    # Simple replacement: find any date-time pattern and replace it
    content = re.sub(
        r'\d{4}-\d{2}-\d{2}-\d{4}(?= UTC)',
        new_version,
        content
    )
    print("  ✓ Updated all version occurrences")
    
    # Also update timestamps in Settings (April 15, 2026 at 6:45 PM)
    month_day_time = now.strftime('%B %d, %Y at %I:%M %p')
    content = re.sub(
        r'[A-Z][a-z]+ \d{1,2}, \d{4} at \d{1,2}:\d{2} (?:AM|PM)(?= \(auto-updated|</p>)',
        month_day_time,
        content
    )
    print("  ✓ Updated timestamp displays")
    
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
