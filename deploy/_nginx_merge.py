"""Врезает наш блок в общий nginx.conf, не трогая чужие проекты.

Вызывается из deploy/nginx-apply.sh:
    python3 _nginx_merge.py <nginx.conf> <output> <begin-marker> <end-marker> < block

Делает три вещи:
  1. вырезает прежний наш блок (между маркерами) — чтобы перезапуск был идемпотентным;
  2. вырезает чужие server{} наших доменов, оставшиеся от прошлой установки без git;
  3. вставляет новый блок перед закрывающей скобкой http{}.
"""
import re
import sys


def find_server_blocks(conf: str):
    """Границы всех server{} верхнего уровня: [(start, end, body), …]."""
    out = []
    for m in re.finditer(r"(?m)^[ \t]*server[ \t]*\{", conf):
        depth, i = 0, m.start()
        while i < len(conf):
            if conf[i] == "{":
                depth += 1
            elif conf[i] == "}":
                depth -= 1
                if depth == 0:
                    break
            i += 1
        if depth == 0:
            out.append((m.start(), i + 1, conf[m.start():i + 1]))
    return out


def main() -> int:
    conf_path, out_path, begin, end = sys.argv[1:5]
    block = sys.stdin.read().rstrip("\n")
    conf = open(conf_path, encoding="utf-8").read()

    # 1. прежний наш блок
    conf, removed_own = re.subn(
        re.escape(begin) + r".*?" + re.escape(end) + r"\n?", "", conf, flags=re.S
    )

    # 2. чужие блоки наших доменов
    domains = sorted({
        line.split()[1].rstrip(";")
        for line in block.splitlines()
        if line.strip().startswith("server_name")
    })
    removed_foreign = 0
    changed = True
    while changed:
        changed = False
        for start, stop, body in find_server_blocks(conf):
            names = re.search(r"server_name\s+([^;]+);", body)
            if not names:
                continue
            listed = names.group(1).split()
            if any(d in listed for d in domains):
                conf = conf[:start] + conf[stop:]
                removed_foreign += 1
                changed = True
                break

    # 3. вставка перед закрывающей скобкой http{}
    idx = conf.rstrip().rfind("}")
    if idx < 0:
        print("не найдена закрывающая скобка http{}", file=sys.stderr)
        return 1
    conf = conf[:idx] + "\n" + block + "\n" + conf[idx:]

    open(out_path, "w", encoding="utf-8").write(conf)
    print(
        f"убрано: прежних наших блоков — {removed_own}, "
        f"чужих блоков наших доменов — {removed_foreign}; "
        f"домены: {', '.join(domains)}",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
