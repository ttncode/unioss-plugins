# Checklist — PHPUnit tests (`application/tests/`)

- [ ] Data provider name rule `provide_{Noun}` — e.g. `provide_datetime`, `provide_product_code`
- [ ] Tests are deterministic and can pass locally without relying on external services or unstable time/data.
- [ ] PHPUnit coverage includes success, validation failure, authorization/security, and edge cases where relevant.
- [ ] Test class names `Snake_case`, test methods `snake_case`.
- [ ] Assertions state the expected value first and are specific (`assertSame` over `assertEquals` for scalars).
- [ ] No spec/ticket identifiers in test comments or test method names — describe the behavior under test.
