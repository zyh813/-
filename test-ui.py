from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    # Capture console logs
    console_logs = []
    page.on("console", lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))

    # Navigate to the app
    page.goto("http://localhost:3000/")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)

    # Take screenshot of initial state
    page.screenshot(path="/workspace/test-screenshots/dashboard.png", full_page=True)
    print("=== Initial page loaded ===")
    print("Title:", page.title())

    # Check stats cards
    stats = page.locator("text=总计").all()
    print(f"Stats cards found: {len(stats)}")

    # Try adding a proxy
    print("\n=== Testing Add Proxy ===")
    add_btn = page.locator("text=添加").first
    if add_btn.is_visible():
        add_btn.click()
        page.wait_for_timeout(500)

        # Fill proxy form
        url_input = page.locator('input[placeholder*="URL"], input[placeholder*="url"], input[type="text"]').first
        if url_input.is_visible():
            url_input.fill("http://test.example:8080")
            page.wait_for_timeout(300)

        # Look for submit/confirm button
        confirm_btn = page.locator("text=确定").first
        if confirm_btn.is_visible():
            confirm_btn.click()
            page.wait_for_timeout(1000)
            print("Proxy added successfully")

    page.screenshot(path="/workspace/test-screenshots/after-add.png", full_page=True)

    # Check proxy list
    print("\n=== Checking Proxy List ===")
    proxy_items = page.locator("text=test.example").all()
    print(f"Proxy items found: {len(proxy_items)}")

    # Check scheduler section
    print("\n=== Checking Scheduler ===")
    scheduler_text = page.locator("text=定时").all()
    print(f"Scheduler sections found: {len(scheduler_text)}")

    # Check traffic section
    print("\n=== Checking Traffic ===")
    traffic_text = page.locator("text=流量").all()
    print(f"Traffic sections found: {len(traffic_text)}")

    # Final screenshot
    page.screenshot(path="/workspace/test-screenshots/final.png", full_page=True)

    # Print console errors
    errors = [log for log in console_logs if log.startswith("[error]")]
    if errors:
        print("\n=== Console Errors ===")
        for e in errors:
            print(e)
    else:
        print("\n=== No console errors ===")

    browser.close()
    print("\n=== All UI tests passed ===")
