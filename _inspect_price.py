from pathlib import Path
import re

t = Path(r"C:\Users\PC\Desktop\cosmetics-frontend\src\pages\fse\FseOrder.tsx").read_text(encoding="utf-8")
print("clampToBand", t.count("clampToBand"))
print("type=text", t.count('type="text"'))
print("Trash2", t.count("Trash2"))
print("invalid=", t.count("invalid="))
# show both price field blocks briefly
idxs = [m.start() for m in re.finditer(r"Price / unit", t)]
print("price fields at", idxs)
for i in idxs:
    print("---")
    print(t[i : i + 350].replace("\n", " | "))
