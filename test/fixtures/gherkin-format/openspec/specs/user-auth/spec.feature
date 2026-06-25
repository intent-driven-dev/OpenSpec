Feature: User authentication

  Rule: Password must meet complexity requirements
    User passwords must contain at least 8 characters.

    Scenario: Short password rejected
      Given a user with password "abc"
      When they try to register
      Then they see a "too short" error

  Rule: Session expires after inactivity
    Sessions are invalidated after 30 minutes of inactivity.

    Scenario: Idle session expires
      Given a user with no activity for 30 minutes
      When they try to perform an action
      Then they are redirected to login
