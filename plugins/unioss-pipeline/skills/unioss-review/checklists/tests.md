# Checklist — PHPUnit tests (`application/tests/`)

- [ ] Data provider name rule `provide_{Noun}` — e.g. `provide_datetime`, `provide_product_code`
- [ ] Tests are deterministic and can pass locally without relying on external services or unstable time/data.
- [ ] Every changed public method has ≥1 test covering it. None at all → 🔴 finding.
- [ ] Write logic (create/update/delete/approve) covers success, validation failure, **and** authorization denial. Any class missing → 🟡.
- [ ] Calculated values (money, tax, quantity, totals) use a data provider covering boundary + rounding cases, not one happy number → 🟡.
- [ ] Test class names `Snake_case`, test methods `snake_case`.
- [ ] Assertions state the expected value first and are specific (`assertSame` over `assertEquals` for scalars).
- [ ] No spec/ticket identifiers in test comments or test method names — describe the behavior under test.
