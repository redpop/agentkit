# Rewriting Confluence Pages

This path is optional. It applies when the original is a Confluence page and the result goes back
there. It needs python3 3.9 or later. Without python3, upload nothing.

`<scripts>` below stands for `${CLAUDE_PLUGIN_ROOT}/skills/clear-docs-de/scripts`.

## Terms

| Term | Meaning |
| --- | --- |
| storage format | The XML format Confluence stores a page in. |
| macro | A block in the storage format: `ac:structured-macro`, such as `info`, or `code` holding Mermaid source. |
| image | An `ac:image` element pointing to an attachment of the page. |
| `macro-id` | The identifier of a macro in the attribute `ac:macro-id`. Confluence needs it to recognize the macro. |
| placeholder | The text `{{macro:N}}` in the Markdown. It stands for saved element number N: a macro, image, link to a Confluence page (`ac:link`), emoticon or task list. |
| approval | The user's explicit yes in the chat to upload. |

## Procedure

1. Load the page in storage format, for example with a Confluence tool of an Atlassian MCP server.
   Save it as `page.xml` in the scratchpad.
2. If the tool returns no storage format, ask the user for another way.
3. Note the page ID and the current version number.
4. Save the macros and images:

   ```bash
   python3 <scripts>/confluence.py extract page.xml macros/
   ```

5. Read `macros/index.txt`. It lists every placeholder with macro type, `macro-id` and content.
6. Write the text as Markdown, working from `macros/page-with-placeholders.xml`.
7. Put every placeholder in its place. Macros and images stand alone on a line. Links and emoticons
   stay inside the sentence.
8. Check the text against the original:

   ```bash
   python3 <scripts>/check_text.py text.md --original page.xml
   ```

9. Convert the text into storage format:

   ```bash
   python3 <scripts>/confluence.py build text.md macros/ -o body.xml --original page.xml
   ```

10. Fix every `FEHLER` and repeat steps 8 and 9.
11. Show the user a summary: title, page ID, new version, number of macros, open questions.
12. Wait for approval. Without approval, upload nothing.
13. Load the page again right before uploading. If the version number changed, someone edited the
    page: ask the user.
14. Upload `body.xml`. If the tool asks for a version number, pass the next one.
15. Load the page again afterwards. Check that the version number rose by 1 and every macro is there.

## What `confluence.py build` guarantees

- Macros and images come back byte for byte from `macros/`, with the same `macro-id`.
- Every `macro-id` of the original appears in the result as often as before.
- A placeholder without a file is a `FEHLER`. A macro without a placeholder is a `FEHLER` too.
- `&`, `<` and `>` in the text become `&amp;`, `&lt;` and `&gt;`. Code spans become `<code>`.
- New code blocks become a `code` macro without `macro-id`; Confluence assigns one itself.
- The result is well-formed XML.

## Diagrams

- The Mermaid source and the PNG show the same diagram. They must match.
- Change a label only when the user asks for it. Then change Mermaid source and PNG together.
- A person creates a new PNG. Note it as an open task.
- If a term in the diagram does not match the term table, change the table or ask.

## Limits

- The converter knows headings, paragraphs, lists (nested too), tables, quotes, code spans, code
  blocks, links, images, bold and italic.
- Links to Confluence pages, emoticons and task lists stay as unchanged placeholders, so their link
  text does not change.
- The converter does not carry over page layouts (`ac:layout`). If the page has columns or sections,
  ask the user before uploading.
- Inline comments hang on the old text and lose their place in a rewrite. Tell the user beforehand.
- The check script reads the storage format only roughly: enough to compare facts, not for a preview.
