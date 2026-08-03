# Checklist — Controllers (`application/controllers/`)

- [ ] Extends `MY_Controller`; acts as a thin coordinator only — receives input, delegates to models/libraries, and returns/renders output. No business or validation logic in the controller; that lives in the model.
- [ ] `My_Controller` must stay slim — only truly universal logic/loads belong there; per-request helpers/models/libraries must be loaded in each controller, not in `My_Controller`
- [ ] No raw SQL; uses CI3 Query Builder via model calls
- [ ] `redirect()` + `return` after every error flash — execution never falls through
- [ ] `html_escape()` on all dynamic view data passed through
- [ ] API/AJAX controller responses use proper HTTP status codes and JSON structure.
- [ ] Lang file loaded in the controller that uses it: `$this->lang->load('xxx_lang')`; accessed via `$this->lang->line('key')`
