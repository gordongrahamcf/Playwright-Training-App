Feature: Home Page
  As a user visiting the Playwright Training Lab
  I want to see an overview of available exercises
  So that I can navigate to the one I want to practise

  Background:
    Given I navigate to "http://localhost:5173"

  Scenario: Home page loads with all four exercise cards
    Then I should see the heading "Playwright Training Lab"
    And I should see 4 exercise cards
    And the cards should be labelled "Forms & Inputs", "Async & Dynamic Content", "Modals & Overlays", and "Tables & Lists"

  Scenario: Each exercise card shows scenario count and progress
    Then each exercise card should display a scenario count
    And each exercise card should display a "0/N complete" progress indicator
    And each exercise card should display a progress bar

  Scenario: Navigating to an exercise from a card
    When I click the "Forms & Inputs" exercise card
    Then the URL should contain "/exercises/forms"
    And I should see the exercise page for "Forms & Inputs"

  Scenario: Playwright Selector Tips panel is collapsed by default
    Then the "Playwright Selector Tips" section should not show its content
    And a toggle button labelled "Playwright Selector Tips" should be visible

  Scenario: Expanding and collapsing the Selector Tips panel
    When I click the "Playwright Selector Tips" toggle button
    Then the tips content should become visible
    And the toggle button should indicate it is expanded
    When I click the toggle button again
    Then the tips content should no longer be visible

  Scenario: Quick Start code block is visible on load
    Then I should see a code block containing "npm run dev"
    And the code block should contain "http://localhost:5173"
