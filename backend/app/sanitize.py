"""Санитизация HTML из WYSIWYG-редактора (защита от XSS на стороне сервера).
Разрешён только контентный allowlist; всё прочее (script, style, on*-атрибуты,
javascript:-ссылки) вырезается. Применяется в Pydantic-валидаторах rich-полей."""
import re

import bleach

# script/style/iframe вычищаются ВМЕСТЕ с содержимым (bleach strip=True оставил бы текст)
_RE_DROP_WITH_CONTENT = re.compile(
    r"<(script|style|iframe|object|embed)\b[^>]*>.*?</\1\s*>",
    re.IGNORECASE | re.DOTALL,
)

ALLOWED_TAGS = [
    "p", "br", "strong", "b", "em", "i", "u", "s",
    "h2", "h3", "ul", "ol", "li", "a", "blockquote",
]
ALLOWED_ATTRS = {"a": ["href", "target", "rel"]}
ALLOWED_PROTOCOLS = ["http", "https", "mailto", "tel"]


def clean_html(value: str) -> str:
    value = _RE_DROP_WITH_CONTENT.sub("", value)
    return bleach.clean(
        value,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRS,
        protocols=ALLOWED_PROTOCOLS,
        strip=True,
    )
