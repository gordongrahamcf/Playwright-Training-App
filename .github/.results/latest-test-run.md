# Codeless Acceptance Test Results
Run date: 2026-03-27T13:33:11.988Z
App URL: http://127.0.0.1:5174

## Summary
| Metric | Count |
|--------|-------|
| Total | 73 |
| Passed | 73 |
| Failed | 0 |
| Skipped | 0 |

## Results by Feature

### Async & Dynamic Content
- [PASS] Clicking "Load Users" shows a loading spinner then 5 user cards
- [PASS] User cards display name and role
- [PASS] Load Users button cannot be clicked a second time after loading
- [PASS] Loading spinner is not visible before the button is clicked
- [PASS] Search input shows all 20 products on initial load
- [PASS] Typing a query filters results after the debounce settles
- [PASS] Search is case-insensitive
- [PASS] Clearing the search input restores all 20 results
- [PASS] A search term that matches nothing shows zero results
- [PASS] Result count uses singular "result" for exactly one match
- [PASS] Initially 5 items are visible and the Load More button is shown
- [PASS] Clicking Load More shows a spinner then adds 5 more items
- [PASS] Load More button disappears after all 20 items are loaded
- [PASS] Items are added cumulatively across multiple clicks

### Forms & Inputs — Registration Form
- [PASS] Successful registration shows a personalised success message
- [PASS] Role dropdown defaults to Tester and accepts other values
- [PASS] Newsletter radio defaults to No
- [PASS] Submitting an empty form shows all required field errors
- [PASS] Blurring an empty Name field shows an inline error
- [PASS] Blurring an invalid email shows a format error
- [PASS] Blurring a password that is too short shows a length error
- [PASS] Blurring a valid email clears any previous email error
- [PASS] Blurring a corrected password field clears the error
- [PASS] Form does not submit when only the terms checkbox is unchecked
- [PASS] Form does not submit when the password is exactly 7 characters
- [PASS] Form does not submit with a malformed email address

### Home Page
- [PASS] Home page loads with all four exercise cards
- [PASS] Each exercise card shows scenario count and progress
- [PASS] Navigating to an exercise from a card
- [PASS] Playwright Selector Tips panel is collapsed by default
- [PASS] Expanding and collapsing the Selector Tips panel
- [PASS] Quick Start code block is visible on load

### Modals & Overlays
- [PASS] Clicking "Delete Account" opens the confirmation modal
- [PASS] Cancelling the modal closes it without deleting the account
- [PASS] Confirming deletion closes the modal and shows the success banner
- [PASS] Pressing Escape closes the confirmation modal
- [PASS] Delete Account button is not shown after a successful deletion
- [PASS] Modal does not appear without clicking Delete Account
- [PASS] Tooltip is not present in the DOM before hovering
- [PASS] Hovering the info button mounts the tooltip in the DOM
- [PASS] Moving the cursor away from the trigger unmounts the tooltip
- [PASS] Clicking "Open Settings" opens the drawer
- [PASS] Drawer contains the expected settings controls
- [PASS] Notifications checkbox is checked by default
- [PASS] Closing the drawer via the X button removes it from view
- [PASS] Clicking the backdrop closes the drawer
- [PASS] Pressing Escape closes the drawer
- [PASS] Drawer is not visible before it is opened

### Tables & Lists — Employee Data Table
- [PASS] Table shows 5 rows on the first page with correct pagination info
- [PASS] First row on page 1 is Alice Chen in Engineering
- [PASS] Selected count starts at zero
- [PASS] Clicking the Name column header sorts rows A–Z
- [PASS] Clicking the Name column header a second time reverses the sort to Z–A
- [PASS] Clicking the Salary column header sorts by salary ascending
- [PASS] Sorting resets pagination to page 1
- [PASS] Clicking a different column replaces the active sort
- [PASS] Typing a name filter reduces the visible rows
- [PASS] Filtering by department shows only matching employees
- [PASS] Filter is case-insensitive
- [PASS] Filtering with no match shows an empty state message
- [PASS] Clearing the filter restores all 20 employees
- [PASS] Filtering resets pagination to page 1
- [PASS] Clicking Next advances to page 2 and shows the next 5 rows
- [PASS] Clicking a page number button navigates directly to that page
- [PASS] Clicking Prev from page 2 returns to page 1
- [PASS] Next button is disabled on the last page
- [PASS] Checking a row checkbox increments the selected count
- [PASS] Unchecking a row checkbox decrements the selected count
- [PASS] Checking the select-all checkbox selects all 5 rows on the current page
- [PASS] Unchecking the select-all checkbox deselects all rows on the current page
- [PASS] Select-all does not affect rows on other pages
- [PASS] Manually checking all rows on a page checks the select-all checkbox
- [PASS] Unchecking one row unchecks the select-all checkbox

## Generation Metadata
- App model generated at: 2026-03-27T13:32:49.010Z
- Start URLs scraped: 6

## Artifacts
- Failure screenshots are available in artifact: codeless-failure-screenshots
- Markdown report is available in artifact: codeless-report
