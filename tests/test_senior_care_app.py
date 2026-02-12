"""
Senior Care Companion - Automated Test Suite
=============================================
Runs against index.html to catch regressions before deployment.

Usage:
    python test_senior_care_app.py                  # test latest file
    python test_senior_care_app.py path/to/file.html

GitHub Actions runs this on every push to main branch.
"""

import sys
import re
import unittest
from pathlib import Path
from bs4 import BeautifulSoup

# ─── Load File ────────────────────────────────────────────────────────────────

HTML_FILE = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent.parent / "index.html"

with open(HTML_FILE, "r", encoding="utf-8") as f:
    RAW_HTML = f.read()

SOUP = BeautifulSoup(RAW_HTML, "html.parser")


# ─── Helper ───────────────────────────────────────────────────────────────────

def get_script_text():
    """Return all JavaScript in the file as one string."""
    scripts = SOUP.find_all("script")
    return "\n".join(s.get_text() for s in scripts)


def get_element_ids():
    """Return set of all element IDs in the document."""
    return {el["id"] for el in SOUP.find_all(id=True)}


# ══════════════════════════════════════════════════════════════════════════════
# TEST CLASS 1: File Basics
# ══════════════════════════════════════════════════════════════════════════════

class TestFileBasis(unittest.TestCase):
    """Sanity checks - file loads, has content, has a version."""

    def test_file_exists(self):
        self.assertTrue(HTML_FILE.exists(), f"index.html not found at {HTML_FILE}")

    def test_file_not_empty(self):
        self.assertGreater(len(RAW_HTML), 10000, "File seems too small - may be corrupt")

    def test_has_doctype(self):
        self.assertTrue(RAW_HTML.strip().startswith("<!DOCTYPE html"), "Missing DOCTYPE")

    def test_has_version_comment(self):
        self.assertIn("VERSION:", RAW_HTML, "No VERSION comment found in file header")

    def test_has_title(self):
        title = SOUP.find("title")
        self.assertIsNotNone(title, "Missing <title> tag")

    def test_single_script_block(self):
        """Warn if there are multiple <script> blocks (can cause issues)."""
        scripts = SOUP.find_all("script")
        self.assertEqual(len(scripts), 1, f"Expected 1 <script> block, found {len(scripts)}")


# ══════════════════════════════════════════════════════════════════════════════
# TEST CLASS 2: Required Sections
# ══════════════════════════════════════════════════════════════════════════════

class TestRequiredSections(unittest.TestCase):
    """Every major app section must exist."""

    REQUIRED_SECTIONS = [
        "loginScreen",
        "registerScreen",
        "mainApp",
        "home",
        "medications",
        "appointments",
        "tasks",
        "bills",
        "activities",
        "contacts",
        "help",
        "profile",
        "settings",
    ]

    def test_all_sections_present(self):
        ids = get_element_ids()
        for section_id in self.REQUIRED_SECTIONS:
            with self.subTest(section=section_id):
                self.assertIn(section_id, ids, f"Missing required section: #{section_id}")


# ══════════════════════════════════════════════════════════════════════════════
# TEST CLASS 3: Profile Cards
# ══════════════════════════════════════════════════════════════════════════════

class TestProfileCards(unittest.TestCase):
    """Profile tab must contain exactly these 3 cards."""

    REQUIRED_PROFILE_CARDS = [
        "profileCard-personalInfo",
        "profileCard-updateProfile",
        "profileCard-changePassword",
    ]

    SHOULD_NOT_BE_IN_PROFILE = [
        "profileCard-voiceSettings",
        "profileCard-notifications",
        "profileCard-dataManagement",
        "profileCard-releaseNotes",
        "profileCard-aboutApp",
    ]

    def test_profile_cards_present(self):
        ids = get_element_ids()
        for card_id in self.REQUIRED_PROFILE_CARDS:
            with self.subTest(card=card_id):
                self.assertIn(card_id, ids, f"Missing Profile card: #{card_id}")

    def test_settings_cards_not_in_profile(self):
        """Regression: cards that were moved to Settings must not re-appear in Profile."""
        ids = get_element_ids()
        for card_id in self.SHOULD_NOT_BE_IN_PROFILE:
            with self.subTest(card=card_id):
                self.assertNotIn(card_id, ids,
                    f"Card {card_id} belongs in Settings, not Profile!")

    def test_profile_toggle_icons_present(self):
        ids = get_element_ids()
        for card_id in ["personalInfo", "updateProfile", "changePassword"]:
            icon_id = f"toggle-icon-{card_id}"
            with self.subTest(icon=icon_id):
                self.assertIn(icon_id, ids, f"Missing toggle icon: #{icon_id}")


# ══════════════════════════════════════════════════════════════════════════════
# TEST CLASS 4: Settings Cards
# ══════════════════════════════════════════════════════════════════════════════

class TestSettingsCards(unittest.TestCase):
    """Settings tab must contain exactly these 5 cards."""

    REQUIRED_SETTINGS_CARDS = [
        "settingsCard-voiceSettings",
        "settingsCard-notifications",
        "settingsCard-dataManagement",
        "settingsCard-releaseNotes",
        "settingsCard-aboutApp",
    ]

    def test_settings_cards_present(self):
        ids = get_element_ids()
        for card_id in self.REQUIRED_SETTINGS_CARDS:
            with self.subTest(card=card_id):
                self.assertIn(card_id, ids, f"Missing Settings card: #{card_id}")

    def test_settings_toggle_icons_present(self):
        ids = get_element_ids()
        for card_id in ["voiceSettings", "notifications", "dataManagement", "releaseNotes", "aboutApp"]:
            icon_id = f"settings-toggle-icon-{card_id}"
            with self.subTest(icon=icon_id):
                self.assertIn(icon_id, ids, f"Missing settings toggle icon: #{icon_id}")

    def test_no_duplicate_settings_card_ids(self):
        """Every settingsCard- ID must appear exactly once."""
        all_ids = [el["id"] for el in SOUP.find_all(id=True)]
        for card_id in self.REQUIRED_SETTINGS_CARDS:
            count = all_ids.count(card_id)
            with self.subTest(card=card_id):
                self.assertEqual(count, 1,
                    f"#{card_id} appears {count} times - must be exactly 1")


# ══════════════════════════════════════════════════════════════════════════════
# TEST CLASS 5: Duplicate / Orphan Detection
# ══════════════════════════════════════════════════════════════════════════════

class TestDuplicateDetection(unittest.TestCase):
    """Catch the kinds of copy-paste bugs we've already seen."""

    def test_no_duplicate_element_ids(self):
        """Regression: duplicate IDs cause silent JS bugs."""
        all_ids = [el["id"] for el in SOUP.find_all(id=True)]
        seen = set()
        duplicates = []
        for eid in all_ids:
            if eid in seen:
                duplicates.append(eid)
            seen.add(eid)
        self.assertEqual(duplicates, [],
            f"Duplicate element IDs found: {duplicates}")

    def test_no_double_card_about_app(self):
        """Regression: About This App previously had two nested <div class='card'> tags."""
        settings_section = SOUP.find("div", {"id": "settings"})
        if settings_section:
            about_area = str(settings_section)
            # Count consecutive card divs (double box pattern)
            double_card = re.search(
                r'<div class="card"[^>]*>\s*<div class="card"', about_area
            )
            self.assertIsNone(double_card,
                "Double nested <div class='card'> detected! About This App has two boxes again.")

    def test_about_app_single_card_wrapper(self):
        """About This App card header must be a direct child of exactly one .card div."""
        settings = SOUP.find("div", {"id": "settings"})
        if not settings:
            self.skipTest("Settings section not found")
        about_content = settings.find("div", {"id": "settingsCard-aboutApp"})
        if not about_content:
            self.skipTest("settingsCard-aboutApp not found")
        # Parent should be .card, grandparent should NOT also be .card
        parent = about_content.parent
        if parent:
            grandparent = parent.parent
            if grandparent:
                self.assertFalse(
                    "card" in (grandparent.get("class") or []),
                    "About This App is double-wrapped in .card divs!"
                )


# ══════════════════════════════════════════════════════════════════════════════
# TEST CLASS 6: Navigation
# ══════════════════════════════════════════════════════════════════════════════

class TestNavigation(unittest.TestCase):
    """Navigation tabs must all be present and wired up correctly."""

    REQUIRED_NAV_SECTIONS = ["home", "medications", "appointments", "tasks",
                              "bills", "activities", "contacts", "help"]

    def test_main_nav_tabs_present(self):
        """Every main nav tab must exist."""
        nav = SOUP.find("div", class_="nav-tabs")
        self.assertIsNotNone(nav, "Missing .nav-tabs div")
        buttons = nav.find_all("button", class_="nav-tab")
        self.assertGreaterEqual(len(buttons), len(self.REQUIRED_NAV_SECTIONS),
            f"Expected at least {len(self.REQUIRED_NAV_SECTIONS)} nav tabs")

    def test_top_nav_profile_button(self):
        self.assertIsNotNone(SOUP.find("button", {"id": "topTab-profile"}),
            "Missing #topTab-profile button")

    def test_top_nav_settings_button(self):
        self.assertIsNotNone(SOUP.find("button", {"id": "topTab-settings"}),
            "Missing #topTab-settings button")

    def test_all_nav_sections_exist(self):
        """Every section referenced in nav tabs must actually exist."""
        ids = get_element_ids()
        for section in self.REQUIRED_NAV_SECTIONS:
            with self.subTest(section=section):
                self.assertIn(section, ids,
                    f"Nav tab references #{section} but that section doesn't exist")


# ══════════════════════════════════════════════════════════════════════════════
# TEST CLASS 7: Installation Instructions
# ══════════════════════════════════════════════════════════════════════════════

class TestInstallationInstructions(unittest.TestCase):
    """Critical UX: installation warning must be present and structured correctly."""

    def test_first_time_warning_exists(self):
        self.assertIsNotNone(
            SOUP.find("div", {"id": "firstTimeUserWarning"}),
            "Missing #firstTimeUserWarning div - seniors won't see install instructions!"
        )

    def test_installation_steps_present(self):
        warning = SOUP.find("div", {"id": "firstTimeUserWarning"})
        if warning:
            steps = warning.find("ol")
            self.assertIsNotNone(steps, "No ordered list of steps in #firstTimeUserWarning")
            items = steps.find_all("li")
            self.assertGreaterEqual(len(items), 4,
                f"Expected at least 4 installation steps, found {len(items)}")

    def test_three_dots_step_present(self):
        """Regression: critical '3 dots' step was missing and caused confusion."""
        warning = SOUP.find("div", {"id": "firstTimeUserWarning"})
        if warning:
            self.assertIn("3 dots", warning.get_text(),
                "Missing critical '3 dots' step in installation instructions!")

    def test_app_installed_flag_set_on_login(self):
        """appInstalled localStorage flag must be set after login."""
        script = get_script_text()
        self.assertIn("appInstalled", script,
            "appInstalled localStorage flag missing from JavaScript")
        self.assertIn("localStorage.setItem('appInstalled'", script,
            "appInstalled is never set in localStorage")

    def test_warning_hidden_for_returning_users(self):
        """Warning must be hidden if appInstalled flag is set."""
        script = get_script_text()
        self.assertIn("firstTimeUserWarning", script,
            "firstTimeUserWarning is not referenced in JS - auto-hide won't work")


# ══════════════════════════════════════════════════════════════════════════════
# TEST CLASS 8: Critical JavaScript Functions
# ══════════════════════════════════════════════════════════════════════════════

class TestJavaScriptFunctions(unittest.TestCase):
    """All key functions must be defined."""

    REQUIRED_FUNCTIONS = [
        "function login()",
        "function logout()",
        "function register()",
        "function showSection(",
        "function showTopSection(",
        "function toggleProfileCard(",
        "function toggleSettingsCard(",
        "function expandAllSettingsCards(",
        "function collapseAllSettingsCards(",
        "function expandAllProfileCards(",
        "function collapseAllProfileCards(",
        "function speak(",
        "function loadAllData(",
        "function saveData(",
        "function loadData(",
        "function updateDashboard(",
    ]

    def test_required_functions_defined(self):
        script = get_script_text()
        for func in self.REQUIRED_FUNCTIONS:
            with self.subTest(func=func):
                self.assertIn(func, script,
                    f"Required function not found: {func}")

    def test_show_top_section_uses_active_class(self):
        """Regression: showTopSection previously used 'hidden' instead of 'active'."""
        script = get_script_text()
        # Find showTopSection function body
        match = re.search(
            r"function showTopSection\(.*?\{(.*?)^        \}", script,
            re.DOTALL | re.MULTILINE
        )
        if match:
            body = match.group(1)
            self.assertIn("classList.add('active')", body,
                "showTopSection must use classList.add('active') - not 'hidden'!")
            self.assertNotIn("classList.add('hidden')", body,
                "showTopSection must NOT use classList.add('hidden') - causes blank Settings!")

    def test_settings_initialization_in_show_top_section(self):
        """Settings cards must be initialized when Settings tab is clicked."""
        script = get_script_text()
        self.assertIn("settingsCard-", script,
            "Settings card initialization missing from showTopSection")


# ══════════════════════════════════════════════════════════════════════════════
# TEST CLASS 9: Mobile UI
# ══════════════════════════════════════════════════════════════════════════════

class TestMobileUI(unittest.TestCase):
    """Mobile-specific checks to prevent known iOS display issues."""

    def test_release_notes_title_not_too_long(self):
        """Regression: long title caused word-wrap on iPhone, pushing arrow left."""
        settings = SOUP.find("div", {"id": "settings"})
        if settings:
            header = settings.find("div", {"id": lambda x: x and "releaseNotes" in x})
            # Find the card header span text
            release_card = SOUP.find("div", {"id": "settingsCard-releaseNotes"})
            if release_card:
                parent = release_card.parent
                span = parent.find("span", recursive=False) if parent else None
                if span:
                    title = span.get_text(strip=True)
                    self.assertLessEqual(len(title), 25,
                        f"Release Notes title too long ({len(title)} chars): '{title}' - will wrap on iPhone!")

    def test_viewport_meta_tag_present(self):
        """Must have viewport meta tag for proper mobile rendering."""
        viewport = SOUP.find("meta", {"name": "viewport"})
        self.assertIsNotNone(viewport, "Missing viewport meta tag - app won't scale properly on iPhone!")

    def test_apple_mobile_web_app_capable(self):
        """Must be marked as a PWA for iOS."""
        pwa_meta = SOUP.find("meta", {"name": "apple-mobile-web-app-capable"})
        self.assertIsNotNone(pwa_meta,
            "Missing apple-mobile-web-app-capable meta tag - won't behave as PWA on iOS!")


# ══════════════════════════════════════════════════════════════════════════════
# TEST CLASS 10: Key UI Elements
# ══════════════════════════════════════════════════════════════════════════════

class TestKeyUIElements(unittest.TestCase):
    """Important UI elements like emergency button, voice toggle etc."""

    REQUIRED_ELEMENT_IDS = [
        "loginScreen",
        "registerScreen",
        "mainApp",
        "loginUsername",
        "loginPassword",
        "userName",
        "voiceToggleBtn",
        "voiceAutoEnable",
        "notificationToggleBtn",
        "profileInfo",
        "updateName",
        "updateAge",
        "updateEmail",
        "homeReminders",
        "floatingHelpBtn",
    ]

    def test_required_ui_elements_exist(self):
        ids = get_element_ids()
        for elem_id in self.REQUIRED_ELEMENT_IDS:
            with self.subTest(element=elem_id):
                self.assertIn(elem_id, ids, f"Missing required UI element: #{elem_id}")

    def test_logout_button_present(self):
        logout = SOUP.find("button", onclick=lambda x: x and "logout()" in x)
        self.assertIsNotNone(logout, "Missing logout button!")

    def test_emergency_section_present(self):
        """Home page should have emergency/911 content."""
        home = SOUP.find("div", {"id": "home"})
        self.assertIsNotNone(home, "Missing home section")
        home_text = home.get_text()
        self.assertIn("911", home_text, "911 emergency reference missing from home page!")


# ══════════════════════════════════════════════════════════════════════════════
# TEST CLASS 11: AI Search Feature
# ══════════════════════════════════════════════════════════════════════════════

class TestAISearchFeature(unittest.TestCase):
    """Tests for AI-powered activity search feature."""

    def test_ai_search_button_exists(self):
        """AI Search button must be present in Activities section."""
        activities = SOUP.find("div", {"id": "activities"})
        self.assertIsNotNone(activities, "Activities section not found")
        
        # Look for button that calls showAISearch()
        ai_button = activities.find("button", onclick=lambda x: x and "showAISearch()" in x)
        self.assertIsNotNone(ai_button,
            "Missing AI Search button in Activities section")

    def test_manual_entry_button_exists(self):
        """Manual entry button must still be available."""
        activities = SOUP.find("div", {"id": "activities"})
        manual_button = activities.find("button", onclick=lambda x: x and "showManualEntry()" in x)
        self.assertIsNotNone(manual_button,
            "Missing Manual Entry button - both options must be available!")

    def test_ai_search_input_exists(self):
        """AI search input box must exist."""
        search_input = SOUP.find("input", {"id": "aiActivitySearch"})
        self.assertIsNotNone(search_input,
            "Missing AI activity search input box (#aiActivitySearch)")

    def test_ai_search_container_exists(self):
        """Container for AI search interface must exist."""
        container = SOUP.find("div", {"id": "aiSearchContainer"})
        self.assertIsNotNone(container,
            "Missing AI search container (#aiSearchContainer)")

    def test_ai_results_container_exists(self):
        """Container for AI search results must exist."""
        results = SOUP.find("div", {"id": "aiSearchResults"})
        self.assertIsNotNone(results,
            "Missing AI search results container (#aiSearchResults)")

    def test_manual_entry_container_exists(self):
        """Manual entry form container must exist."""
        container = SOUP.find("div", {"id": "manualEntryContainer"})
        self.assertIsNotNone(container,
            "Missing manual entry container (#manualEntryContainer)")

    def test_ai_search_function_defined(self):
        """searchActivityWithAI() function must be defined."""
        script = get_script_text()
        self.assertIn("function searchActivityWithAI(", script,
            "Missing searchActivityWithAI() function")
        self.assertIn("async function searchActivityWithAI(", script,
            "searchActivityWithAI() must be async to call API")

    def test_ai_autofill_function_defined(self):
        """Function to auto-fill form from AI results must exist."""
        script = get_script_text()
        self.assertIn("fillActivityFromAI", script,
            "Missing fillActivityFromAI() function")

    def test_show_hide_functions_defined(self):
        """UI toggle functions must be defined."""
        script = get_script_text()
        self.assertIn("function showAISearch(", script,
            "Missing showAISearch() function")
        self.assertIn("function showManualEntry(", script,
            "Missing showManualEntry() function")
        self.assertIn("function hideAISearch(", script,
            "Missing hideAISearch() function")

    def test_ai_search_uses_anthropic_api(self):
        """AI search must use Anthropic API endpoint."""
        script = get_script_text()
        self.assertIn("api.anthropic.com/v1/messages", script,
            "AI search not using Anthropic API endpoint")

    def test_ai_search_uses_web_search_tool(self):
        """AI search must use web_search tool for real-time data."""
        script = get_script_text()
        self.assertIn("web_search", script,
            "AI search not using web_search tool - won't find current info!")

    def test_display_results_function_defined(self):
        """Function to display AI results must exist."""
        script = get_script_text()
        self.assertIn("displayAIResults", script,
            "Missing displayAIResults() function")

    def test_ai_disclaimer_present(self):
        """Must show disclaimer that results are AI-generated."""
        script = get_script_text()
        # Look for disclaimer text in results rendering
        self.assertTrue(
            "AI-suggested" in script or "verify" in script.lower(),
            "Missing AI disclaimer/verification warning - users must know to verify!"
        )

    def test_source_url_shown_in_results(self):
        """AI results must show source URL for verification."""
        script = get_script_text()
        # Check that source URL is displayed in results
        self.assertIn("data.source", script,
            "AI results must show source URL so users can verify information")

    def test_manual_add_activity_button_still_exists(self):
        """Traditional add activity button must remain (regression check)."""
        activities = SOUP.find("div", {"id": "activities"})
        add_btn = activities.find("button", {"id": "addActivityBtn"})
        self.assertIsNotNone(add_btn,
            "Manual 'Add Activity' button removed - must keep it!")
        # Check it still calls addActivity()
        onclick = add_btn.get("onclick", "")
        self.assertIn("addActivity()", onclick,
            "Add Activity button broken - doesn't call addActivity()")


# ══════════════════════════════════════════════════════════════════════════════
# RUNNER
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print(f"\n🧪 Senior Care Companion - Test Suite")
    print(f"📄 Testing: {HTML_FILE}")
    print(f"{'═' * 55}\n")

    loader = unittest.TestLoader()
    loader.sortTestMethodsUsing = None  # Keep class/method order
    suite = loader.loadTestsFromModule(sys.modules[__name__])

    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)

    print(f"\n{'═' * 55}")
    if result.wasSuccessful():
        print(f"✅ ALL {result.testsRun} TESTS PASSED!")
    else:
        print(f"❌ {len(result.failures)} FAILURES, {len(result.errors)} ERRORS")
        print(f"   {result.testsRun - len(result.failures) - len(result.errors)} passed")
    print(f"{'═' * 55}\n")

    sys.exit(0 if result.wasSuccessful() else 1)
