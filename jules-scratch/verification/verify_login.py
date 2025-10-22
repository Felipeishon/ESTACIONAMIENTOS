from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("http://localhost:3001")
        page.fill("#loginEmail", "test@example.com")
        page.fill("#loginPassword", "password")
        page.click("button[type=submit]")
        page.wait_for_selector("#reservationSection")
        page.screenshot(path="jules-scratch/verification/verification.png")
        browser.close()

run()
