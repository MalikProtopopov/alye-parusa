/**
 * Инлайн JSON-LD. «<» экранируется в <, чтобы содержимое CMS не могло
 * закрыть тег <script> (классический XSS-вектор для инлайн-JSON).
 */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
