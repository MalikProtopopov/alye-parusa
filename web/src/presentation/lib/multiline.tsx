import { Fragment } from "react";
import type { ReactNode } from "react";

/** Renders "\n" inside CMS titles as authored line breaks. */
export function multiline(text: string): ReactNode {
  const lines = text.split("\n");
  if (lines.length === 1) return text;
  return lines.map((line, index) => (
    <Fragment key={index}>
      {line}
      {index < lines.length - 1 ? <br /> : null}
    </Fragment>
  ));
}
