import { Footer, Group, Snippet } from './kit'
import type { Kit } from './kit'

const SOURCE = `export const greet = (name: string): string => {
  const hour = new Date().getHours()

  return hour < 12 ? \`Good morning, \${name}\` : \`Hello, \${name}\`
}`

const DIFF = `@@ -1,4 +1,4 @@
 export const greet = (name: string): string => {
-  return 'Hello ' + name
+  return \`Hello, \${name}\`
 }`

const LINK = 'https://example.com'

const MARKDOWN = `### A heading

Text with **bold**, _italic_ and \`code\`.

- a list
- with two items

| Element | Surfaces |
| --- | --- |
| Svg | desktop, vscode, mobile |
| Raster | terminal |

[A link to example.com](${LINK})`

/** Content: code, a diff, Markdown and a link. */
export const contentSection = (k: Kit) => {
  const { Box, Code, Markdown, Link } = k.el
  const t = k.t.content

  return (
    <Box flexDirection="column">
      {Group(k, t.code, [
        <Code source={SOURCE} language="typescript" path="greet.ts" startLine={1} />,
        Snippet(k, '<Code source={…} language="typescript" startLine={1}>'),
      ])}
      {Group(k, t.diff, [
        <Code source={DIFF} language="typescript" format="diff" />,
        Snippet(k, '<Code source={hunks} format="diff">'),
      ])}
      {Group(k, t.markdown, [
        <Markdown
          key="markdown"
          text={MARKDOWN}
          pressableLinks={[LINK]}
          onLinkPress={link => k.act(`Markdown link ${link.href}`)}
        />,
        Snippet(k, '<Markdown text={…} pressableLinks={[href]} onLinkPress={…}>'),
      ])}
      {Group(k, t.link, [<Link href={LINK} label="example.com" />, Snippet(k, `<Link href="${LINK}" label="example.com">`)])}
      {Footer(k, t.missing, t.linkNote)}
    </Box>
  )
}
