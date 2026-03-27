Feature: Forms & Inputs — Registration Form
  As a user on the registration form exercise
  I want to fill in and submit the Create Account form
  So that I can practise form interaction and validation patterns

  Background:
    Given I navigate to "http://localhost:5173/#/exercises/forms"
    And the "Create Account" form is visible

  # ---------------------------------------------------------------------------
  # Happy path
  # ---------------------------------------------------------------------------

  Scenario: Successful registration shows a personalised success message
    When I fill in "Full Name" with "Jane Smith"
    And I fill in "Email" with "jane@example.com"
    And I fill in "Password" with "securepass1"
    And I check the "I accept the terms and conditions" checkbox
    And I click the "Create Account" button
    Then the success message should be visible
    And the success message should contain "Welcome, Jane Smith"
    And the form should no longer be visible

  Scenario: Role dropdown defaults to Tester and accepts other values
    Then the "Role" dropdown should have the value "tester"
    When I select "Developer" from the "Role" dropdown
    Then the "Role" dropdown should have the value "developer"
    When I select "Manager" from the "Role" dropdown
    Then the "Role" dropdown should have the value "manager"

  Scenario: Newsletter radio defaults to No
    Then the "No" newsletter radio button should be selected
    When I select the "Yes" newsletter radio button
    Then the "Yes" newsletter radio button should be selected
    And the "No" newsletter radio button should not be selected

  # ---------------------------------------------------------------------------
  # Validation — submit with empty form
  # ---------------------------------------------------------------------------

  Scenario: Submitting an empty form shows all required field errors
    When I click the "Create Account" button
    Then I should see the error "Name is required"
    And I should see the error "Email is required"
    And I should see the error "Password is required"
    And I should see the error "You must accept the terms"
    And the form should remain visible

  # ---------------------------------------------------------------------------
  # Validation — on blur
  # ---------------------------------------------------------------------------

  Scenario: Blurring an empty Name field shows an inline error
    When I focus the "Full Name" field and then blur it without typing
    Then I should see the error "Name is required" beneath the field

  Scenario: Blurring an invalid email shows a format error
    When I fill in "Email" with "not-an-email"
    And I blur the "Email" field
    Then I should see the error "Enter a valid email address"

  Scenario: Blurring a password that is too short shows a length error
    When I fill in "Password" with "short"
    And I blur the "Password" field
    Then I should see the error "Password must be at least 8 characters"

  Scenario: Blurring a valid email clears any previous email error
    When I fill in "Email" with "bad"
    And I blur the "Email" field
    Then I should see the error "Enter a valid email address"
    When I fill in "Email" with "good@example.com"
    And I blur the "Email" field
    Then the email error should not be visible

  Scenario: Blurring a corrected password field clears the error
    When I fill in "Password" with "short"
    And I blur the "Password" field
    Then I should see the error "Password must be at least 8 characters"
    When I fill in "Password" with "longenoughpassword"
    And I blur the "Password" field
    Then the password error should not be visible

  # ---------------------------------------------------------------------------
  # Negative — form should not submit with missing required fields
  # ---------------------------------------------------------------------------

  Scenario: Form does not submit when only the terms checkbox is unchecked
    When I fill in "Full Name" with "Jane Smith"
    And I fill in "Email" with "jane@example.com"
    And I fill in "Password" with "securepass1"
    And I click the "Create Account" button
    Then I should see the error "You must accept the terms"
    And the success message should not be visible

  Scenario: Form does not submit when the password is exactly 7 characters
    When I fill in "Full Name" with "Jane Smith"
    And I fill in "Email" with "jane@example.com"
    And I fill in "Password" with "short12"
    And I check the "I accept the terms and conditions" checkbox
    And I click the "Create Account" button
    Then I should see the error "Password must be at least 8 characters"
    And the success message should not be visible

  Scenario: Form does not submit with a malformed email address
    When I fill in "Full Name" with "Jane Smith"
    And I fill in "Email" with "jane@"
    And I fill in "Password" with "securepass1"
    And I check the "I accept the terms and conditions" checkbox
    And I click the "Create Account" button
    Then I should see the error "Enter a valid email address"
    And the success message should not be visible
