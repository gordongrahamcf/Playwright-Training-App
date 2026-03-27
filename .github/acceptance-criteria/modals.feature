Feature: Modals & Overlays
  As a user on the modals exercise page
  I want to interact with confirmation dialogs, tooltips, and a side drawer
  So that I can practise handling overlays and conditional DOM elements in Playwright

  Background:
    Given I navigate to "http://localhost:5173/#/exercises/modals"

  # ---------------------------------------------------------------------------
  # Section A — Confirmation Modal
  # ---------------------------------------------------------------------------

  Scenario: Clicking "Delete Account" opens the confirmation modal
    When I click the "Delete Account" button
    Then the confirmation modal should be visible
    And the modal should contain the heading "Confirm Deletion"
    And the modal should contain the text "This action cannot be undone"
    And the modal should have a "Cancel" button
    And the modal should have a "Delete" button

  Scenario: Cancelling the modal closes it without deleting the account
    When I click the "Delete Account" button
    And I click the "Cancel" button in the modal
    Then the confirmation modal should not be visible
    And the "Delete Account" button should still be visible
    And the success banner should not be visible

  Scenario: Confirming deletion closes the modal and shows the success banner
    When I click the "Delete Account" button
    And I click the "Delete" button in the modal
    Then the confirmation modal should not be visible
    And the success banner should be visible
    And the success banner should read "Account deleted successfully."
    And the "Delete Account" button should not be visible

  Scenario: Pressing Escape closes the confirmation modal
    When I click the "Delete Account" button
    Then the confirmation modal should be visible
    When I press the "Escape" key
    Then the confirmation modal should not be visible
    And the "Delete Account" button should still be visible

  Scenario: Delete Account button is not shown after a successful deletion
    When I click the "Delete Account" button
    And I click the "Delete" button in the modal
    Then the "Delete Account" button should not be visible
    And the success banner should be visible

  Scenario: Modal does not appear without clicking Delete Account
    Then the confirmation modal should not be visible

  # ---------------------------------------------------------------------------
  # Section B — Tooltip on Hover
  # ---------------------------------------------------------------------------

  Scenario: Tooltip is not present in the DOM before hovering
    Then the tooltip content should not be present in the DOM

  Scenario: Hovering the info button mounts the tooltip in the DOM
    When I hover over the tooltip trigger button
    Then the tooltip content should be visible
    And the tooltip should read "This feature requires admin privileges to configure."

  Scenario: Moving the cursor away from the trigger unmounts the tooltip
    When I hover over the tooltip trigger button
    Then the tooltip content should be visible
    When I move the cursor away from the tooltip trigger
    Then the tooltip content should not be present in the DOM

  # ---------------------------------------------------------------------------
  # Section C — Side Drawer
  # ---------------------------------------------------------------------------

  Scenario: Clicking "Open Settings" opens the drawer
    When I click the "Open Settings" button
    Then the drawer should be visible
    And the drawer should contain the heading "Settings"
    And the drawer backdrop should be visible

  Scenario: Drawer contains the expected settings controls
    When I click the "Open Settings" button
    Then the drawer should contain a "Dark Mode" checkbox
    And the drawer should contain a "Notifications" checkbox
    And the drawer should contain a "Language" dropdown

  Scenario: Notifications checkbox is checked by default
    When I click the "Open Settings" button
    Then the "Notifications" checkbox in the drawer should be checked

  Scenario: Closing the drawer via the X button removes it from view
    When I click the "Open Settings" button
    And I click the close (✕) button in the drawer header
    Then the drawer should not be visible
    And the drawer backdrop should not be visible

  Scenario: Clicking the backdrop closes the drawer
    When I click the "Open Settings" button
    Then the drawer should be visible
    When I click the drawer backdrop
    Then the drawer should not be visible

  Scenario: Pressing Escape closes the drawer
    When I click the "Open Settings" button
    Then the drawer should be visible
    When I press the "Escape" key
    Then the drawer should not be visible

  Scenario: Drawer is not visible before it is opened
    Then the drawer should not be visible
    And the drawer backdrop should not be visible
