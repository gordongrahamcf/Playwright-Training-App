Feature: Tables & Lists — Employee Data Table
  As a user on the tables exercise page
  I want to sort, filter, paginate, and select rows in the employee table
  So that I can practise complex list interactions in Playwright

  Background:
    Given I navigate to "http://localhost:5173/#/exercises/tables"
    And the employee table is visible

  # ---------------------------------------------------------------------------
  # Initial state
  # ---------------------------------------------------------------------------

  Scenario: Table shows 5 rows on the first page with correct pagination info
    Then the table should display 5 rows
    And the pagination info should read "Showing 1–5 of 20"
    And the "← Prev" button should be disabled
    And the "Next →" button should be enabled
    And there should be 4 page number buttons

  Scenario: First row on page 1 is Alice Chen in Engineering
    Then the first table row should contain "Alice Chen"
    And the first table row should contain "Engineering"

  Scenario: Selected count starts at zero
    Then the selected count should read "0 selected"

  # ---------------------------------------------------------------------------
  # Sorting
  # ---------------------------------------------------------------------------

  Scenario: Clicking the Name column header sorts rows A–Z
    When I click the "Name" column header
    Then the table rows should be sorted alphabetically ascending by name
    And the Name column header should show an ascending sort indicator

  Scenario: Clicking the Name column header a second time reverses the sort to Z–A
    When I click the "Name" column header
    And I click the "Name" column header again
    Then the table rows should be sorted alphabetically descending by name
    And the Name column header should show a descending sort indicator

  Scenario: Clicking the Salary column header sorts by salary ascending
    When I click the "Salary" column header
    Then the first row in the table should show the lowest salary
    And the Salary column header should show an ascending sort indicator

  Scenario: Sorting resets pagination to page 1
    When I click page "2" in the pagination controls
    And I click the "Department" column header
    Then the pagination info should read "Showing 1–5 of 20"

  Scenario: Clicking a different column replaces the active sort
    When I click the "Name" column header
    And I click the "Status" column header
    Then the Status column header should show a sort indicator
    And the Name column header should show the neutral (unsorted) indicator

  # ---------------------------------------------------------------------------
  # Filtering
  # ---------------------------------------------------------------------------

  Scenario: Typing a name filter reduces the visible rows
    When I type "Alice" into the filter input
    Then the table should display 1 row
    And the pagination info should read "Showing 1–1 of 1"
    And the row should contain "Alice Chen"

  Scenario: Filtering by department shows only matching employees
    When I type "Engineering" into the filter input
    Then the table should display 5 rows
    And the pagination info should read "Showing 1–5 of 6"

  Scenario: Filter is case-insensitive
    When I type "engineering" into the filter input
    Then the pagination info should contain "of 6"

  Scenario: Filtering with no match shows an empty state message
    When I type "xyznotadepartment" into the filter input
    Then the table should display the message "No results found."
    And the pagination info should read "No results"

  Scenario: Clearing the filter restores all 20 employees
    When I type "Finance" into the filter input
    Then the pagination info should contain "of 5"
    When I clear the filter input
    Then the pagination info should read "Showing 1–5 of 20"

  Scenario: Filtering resets pagination to page 1
    When I click page "2" in the pagination controls
    And I type "Marketing" into the filter input
    Then the pagination info should contain "Showing 1–"

  # ---------------------------------------------------------------------------
  # Pagination
  # ---------------------------------------------------------------------------

  Scenario: Clicking Next advances to page 2 and shows the next 5 rows
    When I click the "Next →" button
    Then the pagination info should read "Showing 6–10 of 20"
    And the table should display 5 rows
    And the "← Prev" button should be enabled

  Scenario: Clicking a page number button navigates directly to that page
    When I click page "3" in the pagination controls
    Then the pagination info should read "Showing 11–15 of 20"

  Scenario: Clicking Prev from page 2 returns to page 1
    When I click the "Next →" button
    And I click the "← Prev" button
    Then the pagination info should read "Showing 1–5 of 20"
    And the "← Prev" button should be disabled

  Scenario: Next button is disabled on the last page
    When I click page "4" in the pagination controls
    Then the pagination info should read "Showing 16–20 of 20"
    And the "Next →" button should be disabled

  # ---------------------------------------------------------------------------
  # Row selection
  # ---------------------------------------------------------------------------

  Scenario: Checking a row checkbox increments the selected count
    When I check the checkbox on the first table row
    Then the selected count should read "1 selected"

  Scenario: Unchecking a row checkbox decrements the selected count
    When I check the checkbox on the first table row
    And I uncheck the checkbox on the first table row
    Then the selected count should read "0 selected"

  Scenario: Checking the select-all checkbox selects all 5 rows on the current page
    When I check the select-all checkbox in the table header
    Then all 5 row checkboxes should be checked
    And the selected count should read "5 selected"
    And the select-all checkbox should be checked

  Scenario: Unchecking the select-all checkbox deselects all rows on the current page
    When I check the select-all checkbox in the table header
    And I uncheck the select-all checkbox in the table header
    Then all 5 row checkboxes should be unchecked
    And the selected count should read "0 selected"

  Scenario: Select-all does not affect rows on other pages
    When I check the select-all checkbox in the table header
    And I click page "2" in the pagination controls
    Then the selected count should read "5 selected"
    And the row checkboxes on page 2 should not be checked

  Scenario: Manually checking all rows on a page checks the select-all checkbox
    When I check the checkbox on each of the 5 rows individually
    Then the select-all checkbox should be checked

  Scenario: Unchecking one row unchecks the select-all checkbox
    When I check the select-all checkbox in the table header
    And I uncheck the checkbox on the first table row
    Then the select-all checkbox should not be checked
    And the selected count should read "4 selected"
