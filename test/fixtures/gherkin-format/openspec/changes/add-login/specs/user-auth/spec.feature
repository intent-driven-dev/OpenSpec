Feature: User authentication changes

  # @openspec: ADDED
  Rule: Email must be verified before login
    Unverified accounts cannot log in to the system.

    Scenario: Unverified user is blocked
      Given an account with an unverified email address
      When the user attempts to log in
      Then access is denied with a "verify your email" message

  # @openspec: REMOVED
  Rule: Session expires after inactivity

  # @openspec: RENAMED from="Password must meet complexity requirements" to="Password complexity is enforced"
