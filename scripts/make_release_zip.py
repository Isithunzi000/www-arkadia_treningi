#!/usr/bin/env python3
"""Deterministyczny build zipa release'owego rozszerzenia arkadia_treningi (WWW).

Wejscie: katalog zrodlowy zawierajacy arkadia_treningi/{treningi.js,manifest.json}
(zrodlo prawdy zyje w zipach w releases/; ten skrypt je odtwarza).
Wyjscie: releases/arkadia_treningi_<wersja>.zip — wpisy sortowane, timestampy
sztywne (1980-01-01), stale uprawnienia, STORED; podwojny build =
identyczny SHA-256.

Uzycie:
  python3 scripts/make_release_zip.py <katalog_zrodlowy> <wersja>
Przyklad (nowa wersja 1.0.9):
  mkdir src && cp -r arkadia_treningi src/   # po edycji treningi.js/manifest.json
  python3 scripts/make_release_zip.py src 1.0.9
  -> releases/arkadia_treningi_1_0_9.zip; potem: git add releases/ && push
     (workflow Pages zbuduje dist/ i index.json sam)
"""
import hashlib
import os
import re
import sys
import zipfile

PKG = "arkadia_treningi"
FILES = ["treningi.js", "manifest.json"]
FIXED_DATE = (1980, 1, 1, 0, 0, 0)
DIR_ATTR = 0o40775 << 16
FILE_ATTR = 0o100644 << 16


def write_entry(zf, arcname, data=None):
    zi = zipfile.ZipInfo(arcname, date_time=FIXED_DATE)
    if data is None:
        zi.external_attr = DIR_ATTR
        zf.writestr(zi, b"")
    else:
        zi.external_attr = FILE_ATTR
        zi.compress_type = zipfile.ZIP_STORED
        zf.writestr(zi, data)


def build(src_root, version, out_path):
    pkg_dir = os.path.join(src_root, PKG)
    for name in FILES:
        if not os.path.isfile(os.path.join(pkg_dir, name)):
            raise SystemExit("BLAD: brak " + os.path.join(pkg_dir, name))
    with zipfile.ZipFile(out_path, "w") as zf:
        write_entry(zf, PKG + "/")
        for name in sorted(FILES):
            with open(os.path.join(pkg_dir, name), "rb") as f:
                write_entry(zf, PKG + "/" + name, f.read())
    h = hashlib.sha256()
    with open(out_path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    print(h.hexdigest() + "  " + out_path)


def main():
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    src_root, version = sys.argv[1], sys.argv[2]
    if not re.fullmatch(r"\d+\.\d+\.\d+", version):
        raise SystemExit("BLAD: wersja ma byc w formacie X.Y.Z, dostalem: " + version)
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out = os.path.join(here, "releases", PKG + "_" + version.replace(".", "_") + ".zip")
    build(src_root, version, out)


if __name__ == "__main__":
    main()
