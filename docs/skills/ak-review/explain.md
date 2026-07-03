# Explain

> Explains a code snippet to a developer without suggesting improvements.

## Overview

Explains what a piece of code does, why it is built that way, and what is notable about it -- strictly based on the
visible snippet, with no assumptions about callers or surrounding context and no improvement suggestions. Produces a
fixed three-part structure (Purpose, How it works, Noteworthy) scaled to the length of the snippet.

## Usage

```text
/ak-review:explain [code snippet]
```

If code is currently selected in the editor, the selection is explained and no snippet needs to be passed.

## Examples

```text
/ak-review:explain
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
```

Explains the pasted `debounce` function: its purpose, the closure-based timer mechanism, and (if applicable) any
noteworthy language features.

```text
Explain this: [paste a selector or hook]
```

An introductory sentence before the snippet is ignored -- only the code portion is explained.

## When to Use

- Onboarding onto unfamiliar code or preparing for a review
- Understanding a snippet without receiving refactoring or improvement suggestions
- Needing statements strictly grounded in the visible code, with no assumptions about callers or external context

## Best Practices

- Paste the smallest snippet that is self-contained enough to explain
- For long files, explain function by function rather than the whole file at once
- Use this instead of `/ak-review:coderabbit` when you want understanding, not a quality/bug review
