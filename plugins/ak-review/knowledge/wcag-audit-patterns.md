# WCAG 2.2 Audit Patterns

Comprehensive checklist for auditing web content against WCAG 2.2 guidelines, organized
by the four POUR principles. Includes conformance levels, concrete code examples,
automated testing approaches, and remediation patterns.

This complements the Accessibility section in `review-dimensions.md` with full WCAG
criterion coverage.

## Conformance Levels

| Level | Description | Regulatory Context |
|---|---|---|
| **A** | Minimum accessibility | Legal baseline in most jurisdictions |
| **AA** | Standard conformance | Required by most regulations (ADA, EN 301 549, EAA) |
| **AAA** | Enhanced accessibility | Specialized contexts, not typically required site-wide |

## Common Violations by Severity

**Critical (blocks access entirely):**

- Missing alt text for functional images
- No keyboard access to interactive elements
- Missing form labels
- Auto-playing media without controls

**Serious (significant barriers):**

- Insufficient color contrast
- Missing skip navigation links
- Inaccessible custom widgets (dropdowns, modals, tabs)
- Missing page titles

**Moderate (usability friction):**

- Missing `lang` attribute
- Vague link text ("click here", "read more")
- Missing landmark regions
- Broken heading hierarchy

---

## Perceivable (Principle 1)

### 1.1.1 Non-text Content (A)

- [ ] All informative images have descriptive alt text
- [ ] Decorative images use `alt=""`
- [ ] Complex images (charts, diagrams) have extended descriptions
- [ ] Icons conveying meaning have accessible names
- [ ] CAPTCHAs provide alternatives

```html
<!-- Informative image -->
<img src="chart.png" alt="Sales increased 25% from Q1 to Q2" />

<!-- Decorative image -->
<img src="divider.png" alt="" />
```

### 1.2 Time-based Media (A)

- [ ] Audio content has a text transcript
- [ ] Video has synchronized captions (accurate, complete, speaker-identified)
- [ ] Video has audio description for significant visual-only content

### 1.3.1 Info and Relationships (A)

- [ ] Headings use proper `h1`-`h6` tags in logical hierarchy
- [ ] Lists use `ul`, `ol`, `dl` — not styled `div`s
- [ ] Data tables have `th` with `scope` attributes
- [ ] Form inputs are associated with `label` elements
- [ ] ARIA landmarks define page regions (`main`, `nav`, `aside`, `footer`)

```html
<table>
  <thead>
    <tr>
      <th scope="col">Name</th>
      <th scope="col">Price</th>
    </tr>
  </thead>
</table>
```

### 1.3.2 Meaningful Sequence (A)

- [ ] DOM order matches visual reading order
- [ ] CSS positioning doesn't break logical sequence
- [ ] Focus order follows visual flow

### 1.3.3 Sensory Characteristics (A)

- [ ] Instructions don't rely solely on shape, color, or position
- [ ] Example: "Click the red button" → "Click Submit"

### 1.4.1 Use of Color (A)

- [ ] Color is not the only way information is conveyed
- [ ] Links distinguishable from surrounding text without color
- [ ] Error states use icons or text in addition to color

### 1.4.3 Contrast Minimum (AA)

- [ ] Normal text: 4.5:1 contrast ratio against background
- [ ] Large text (18pt+ or 14pt+ bold): 3:1 ratio
- [ ] UI components and graphical objects: 3:1 ratio

Tools: WebAIM Contrast Checker, axe DevTools, Chrome DevTools Accessibility panel

### 1.4.4 Resize Text (AA)

- [ ] Content remains usable at 200% text zoom
- [ ] No horizontal scrolling at 320px viewport width

### 1.4.10 Reflow (AA)

- [ ] Content reflows to single column at 400% zoom
- [ ] No two-dimensional scrolling except for content that requires it (maps, tables, diagrams)
- [ ] All content accessible at 320px width

### 1.4.11 Non-text Contrast (AA)

- [ ] UI components (buttons, inputs, toggles) have 3:1 contrast against adjacent colors
- [ ] Focus indicators are visually distinct
- [ ] Graphical elements essential to understanding have sufficient contrast

### 1.4.12 Text Spacing (AA)

- [ ] No content loss or overlap when these values are applied:
  - Line height: 1.5x font size
  - Paragraph spacing: 2x font size
  - Letter spacing: 0.12x font size
  - Word spacing: 0.16x font size

---

## Operable (Principle 2)

### 2.1.1 Keyboard (A)

- [ ] All interactive elements reachable and operable via keyboard
- [ ] Tab order follows logical reading order
- [ ] Custom widgets support expected keyboard patterns (Enter, Space, Arrow keys, Escape)

```html
<div role="button" tabindex="0"
     onkeydown="if(event.key==='Enter'||event.key===' ') activate()">
  Submit
</div>
```

### 2.1.2 No Keyboard Trap (A)

- [ ] Focus can always move away from every component
- [ ] Modal dialogs trap focus correctly but release on close
- [ ] Focus returns to trigger element after modal closes

### 2.2.1 Timing Adjustable (A)

- [ ] Session timeouts can be extended or disabled
- [ ] User warned before timeout with option to extend

### 2.2.2 Pause, Stop, Hide (A)

- [ ] Moving, blinking, or auto-updating content can be paused
- [ ] Animations respect `prefers-reduced-motion`

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### 2.3.1 Three Flashes (A)

- [ ] No content flashes more than 3 times per second
- [ ] Flashing area is small (less than 25% of viewport)

### 2.4.1 Bypass Blocks (A)

- [ ] "Skip to main content" link present and functional
- [ ] Landmark regions (`main`, `nav`, `aside`) defined
- [ ] Heading structure enables navigation

```html
<a href="#main" class="skip-link">Skip to main content</a>
<main id="main">...</main>
```

### 2.4.2 Page Titled (A)

- [ ] Every page has a unique, descriptive `<title>`
- [ ] Title reflects the specific page content

### 2.4.3 Focus Order (A)

- [ ] Focus order matches visual layout order
- [ ] `tabindex` used correctly (0 for natural order, -1 for programmatic only, avoid positive values)

### 2.4.4 Link Purpose (A)

- [ ] Link text makes sense out of context
- [ ] No generic "click here" or "read more" without context

```html
<!-- Avoid -->
<a href="report.pdf">Click here</a>

<!-- Preferred -->
<a href="report.pdf">Download Q4 Sales Report (PDF)</a>
```

### 2.4.6 Headings and Labels (AA)

- [ ] Headings accurately describe the content that follows
- [ ] Form labels clearly describe their purpose

### 2.4.7 Focus Visible (AA)

- [ ] Focus indicator visible on all interactive elements
- [ ] Custom focus styles meet contrast requirements

```css
:focus-visible {
  outline: 3px solid #005fcc;
  outline-offset: 2px;
}
```

### 2.4.11 Focus Not Obscured (AA) — WCAG 2.2

- [ ] Focused element is not completely hidden by sticky headers, banners, or overlays

---

## Understandable (Principle 3)

### 3.1.1 Language of Page (A)

- [ ] `<html lang="...">` attribute is set and correct

### 3.1.2 Language of Parts (AA)

- [ ] Inline language changes are marked with `lang` attribute

```html
<p>The French word <span lang="fr">bonjour</span> means hello.</p>
```

### 3.2.1 On Focus (A)

- [ ] No unexpected context change (navigation, popup) when an element receives focus

### 3.2.2 On Input (A)

- [ ] No automatic form submission when a field value changes
- [ ] User warned before context changes triggered by input

### 3.2.3 Consistent Navigation (AA)

- [ ] Navigation menus appear in the same order across pages
- [ ] Repeated UI components maintain consistent positioning

### 3.2.4 Consistent Identification (AA)

- [ ] Same functionality uses the same label everywhere
- [ ] Icons are used consistently throughout

### 3.3.1 Error Identification (A)

- [ ] Errors clearly identified in text (not just color)
- [ ] Error message describes the problem specifically
- [ ] Error is programmatically linked to the field

```html
<input aria-describedby="email-error" aria-invalid="true" />
<span id="email-error" role="alert">Please enter a valid email address</span>
```

### 3.3.2 Labels or Instructions (A)

- [ ] All form inputs have visible labels
- [ ] Required fields clearly indicated
- [ ] Expected format described (e.g., "YYYY-MM-DD")

### 3.3.3 Error Suggestion (AA)

- [ ] Error messages include specific correction suggestions
- [ ] Suggestions are actionable, not generic

### 3.3.4 Error Prevention (AA)

- [ ] Legal, financial, or data-deleting actions are reversible or require confirmation
- [ ] User can review data before final submission

---

## Robust (Principle 4)

### 4.1.2 Name, Role, Value (A)

- [ ] Custom widgets have accessible names via `aria-label` or `aria-labelledby`
- [ ] ARIA roles match the widget behavior
- [ ] State changes (expanded, selected, checked) are announced

```html
<div role="checkbox" aria-checked="false" tabindex="0"
     aria-labelledby="terms-label">
</div>
<span id="terms-label">Accept terms and conditions</span>
```

### 4.1.3 Status Messages (AA)

- [ ] Status updates use `role="status"` with `aria-live="polite"`
- [ ] Urgent alerts use `role="alert"` with `aria-live="assertive"`

```html
<div role="status" aria-live="polite">3 items added to cart</div>
<div role="alert" aria-live="assertive">Payment failed. Please try again.</div>
```

---

## Automated Testing

```bash
# CLI tools for quick scans
npx @axe-core/cli https://example.com
npx pa11y https://example.com
lighthouse https://example.com --only-categories=accessibility
```

Automated tools catch 30-50% of issues. The rest requires manual testing —
keyboard navigation, screen reader behavior, and cognitive assessment.

## Remediation Patterns

### Missing Form Labels

```html
<!-- Option 1: Visible label (preferred) -->
<label for="email">Email address</label>
<input id="email" type="email" />

<!-- Option 2: Hidden label via aria-label -->
<input type="email" aria-label="Email address" />

<!-- Option 3: Label by reference -->
<span id="email-label">Email</span>
<input type="email" aria-labelledby="email-label" />
```

### Insufficient Contrast

```css
/* Before: 2.5:1 contrast — fails AA */
.text { color: #999; background: #fff; }

/* After: 4.6:1 contrast — passes AA */
.text { color: #595959; background: #fff; }
```

### Keyboard-Accessible Custom Widget

```javascript
element.setAttribute("tabindex", "0");
element.setAttribute("role", "combobox");
element.setAttribute("aria-expanded", "false");

element.addEventListener("keydown", (e) => {
  switch (e.key) {
    case "Enter":
    case " ":
      toggle(); e.preventDefault(); break;
    case "Escape":
      close(); break;
    case "ArrowDown":
      focusNext(); e.preventDefault(); break;
    case "ArrowUp":
      focusPrevious(); e.preventDefault(); break;
  }
});
```
