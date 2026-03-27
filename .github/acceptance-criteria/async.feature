Feature: Async & Dynamic Content
  As a user on the async exercise page
  I want to interact with loading states, debounced search, and paginated lists
  So that I can practise waiting for async UI changes in Playwright

  Background:
    Given I navigate to "http://localhost:5173/#/exercises/async"

  # ---------------------------------------------------------------------------
  # Section A — User Fetch (1.5 s simulated delay)
  # ---------------------------------------------------------------------------

  Scenario: Clicking "Load Users" shows a loading spinner then 5 user cards
    When I click the "Load Users" button
    Then the loading spinner should be visible
    And the "Load Users" button should be disabled
    When the loading spinner disappears
    Then 5 user cards should be visible in the user list
    And the loading spinner should not be visible

  Scenario: User cards display name and role
    When I click the "Load Users" button
    And the user list is visible
    Then the user list should contain a card for "Alice Chen" with role "Engineer"
    And the user list should contain a card for "Bob Martinez" with role "Designer"
    And the user list should contain a card for "Carol White" with role "PM"
    And the user list should contain a card for "David Kim" with role "QA"
    And the user list should contain a card for "Eva Rodriguez" with role "Engineer"

  Scenario: Load Users button cannot be clicked a second time after loading
    When I click the "Load Users" button
    And the user list is visible
    Then the "Load Users" button should be disabled

  Scenario: Loading spinner is not visible before the button is clicked
    Then the loading spinner should not be visible
    And the user list should not be visible

  # ---------------------------------------------------------------------------
  # Section B — Debounced Search (400 ms debounce)
  # ---------------------------------------------------------------------------

  Scenario: Search input shows all 20 products on initial load
    Then the result count should read "Showing all 20"
    And the search results list should contain 20 items

  Scenario: Typing a query filters results after the debounce settles
    When I type "widget" into the search input
    And I wait for the debounce to settle
    Then the result count should read "3 results"
    And every visible result item should contain "Widget"

  Scenario: Search is case-insensitive
    When I type "WIDGET" into the search input
    And I wait for the debounce to settle
    Then the result count should read "3 results"

  Scenario: Clearing the search input restores all 20 results
    When I type "keyboard" into the search input
    And I wait for the debounce to settle
    Then the result count should read "1 result"
    When I clear the search input
    And I wait for the debounce to settle
    Then the result count should read "Showing all 20"
    And the search results list should contain 20 items

  Scenario: A search term that matches nothing shows zero results
    When I type "xyznotaproduct" into the search input
    And I wait for the debounce to settle
    Then the result count should read "0 results"
    And the search results list should be empty

  Scenario: Result count uses singular "result" for exactly one match
    When I type "keyboard" into the search input
    And I wait for the debounce to settle
    Then the result count should read "1 result"

  # ---------------------------------------------------------------------------
  # Section C — Load More (800 ms delay, 5 items per load, 20 total)
  # ---------------------------------------------------------------------------

  Scenario: Initially 5 items are visible and the Load More button is shown
    Then the item list should contain 5 items
    And the "Load More" button should be visible

  Scenario: Clicking Load More shows a spinner then adds 5 more items
    When I click the "Load More" button
    Then the load-more spinner should be visible
    And the "Load More" button should not be visible during loading
    When the load-more spinner disappears
    Then the item list should contain 10 items
    And the "Load More" button should be visible

  Scenario: Load More button disappears after all 20 items are loaded
    When I click "Load More" until all items are loaded
    Then the item list should contain 20 items
    And the "Load More" button should not be visible

  Scenario: Items are added cumulatively across multiple clicks
    When I click the "Load More" button and wait for it to finish
    Then the item list should contain 10 items
    When I click the "Load More" button and wait for it to finish
    Then the item list should contain 15 items
    When I click the "Load More" button and wait for it to finish
    Then the item list should contain 20 items
