"""Make Remotion's compositor run on glibc 2.34.

The prebuilt compositor needs exactly one symbol from glibc 2.35:
hypot@GLIBC_2.35 (glibc 2.35 re-versioned hypot; 2.34 still exports the
original hypot@GLIBC_2.2.5 with identical semantics).

This copies @remotion/compositor-linux-x64-gnu into bin/compositor and
rewrites the GLIBC_2.35 version-need entry under libm.so.6 to GLIBC_2.2.5
(same version index), so hypot binds to the 2.34 implementation.
node_modules is left untouched; remotion.config.ts points
setBinariesDirectory at bin/compositor.
"""
import os
import shutil
import struct

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = f"{ROOT}/node_modules/@remotion/compositor-linux-x64-gnu"
DST = f"{ROOT}/bin/compositor"


def elf_hash(name: bytes) -> int:
    h = 0
    for c in name:
        h = ((h << 4) + c) & 0xFFFFFFFF
        g = h & 0xF0000000
        if g:
            h ^= g >> 24
        h &= ~g & 0xFFFFFFFF
    return h


if os.path.exists(DST):
    shutil.rmtree(DST)
shutil.copytree(SRC, DST)
path = f"{DST}/remotion"
data = bytearray(open(path, "rb").read())

# ELF64 little-endian section headers
e_shoff = struct.unpack_from("<Q", data, 0x28)[0]
e_shentsize, e_shnum, e_shstrndx = struct.unpack_from("<HHH", data, 0x3A)


def sh(i):
    off = e_shoff + i * e_shentsize
    name, typ, flags, addr, offset, size, link, info, align, entsize = struct.unpack_from("<IIQQQQIIQQ", data, off)
    return dict(name=name, type=typ, offset=offset, size=size, link=link, info=info)


secs = [sh(i) for i in range(e_shnum)]
SHT_GNU_verneed = 0x6FFFFFFE
vr = next(s for s in secs if s["type"] == SHT_GNU_verneed)
dynstr = secs[vr["link"]]


def cstr(off):
    start = dynstr["offset"] + off
    end = data.index(b"\0", start)
    return bytes(data[start:end])


# find the offset of "GLIBC_2.2.5" in .dynstr
blob = bytes(data[dynstr["offset"]: dynstr["offset"] + dynstr["size"]])
target_off = blob.index(b"GLIBC_2.2.5\0")
target_hash = elf_hash(b"GLIBC_2.2.5")

patched = 0
off = vr["offset"]
for _ in range(vr["info"]):
    vn_version, vn_cnt, vn_file, vn_aux, vn_next = struct.unpack_from("<HHIII", data, off)
    lib = cstr(vn_file)
    aux = off + vn_aux
    for _ in range(vn_cnt):
        vna_hash, vna_flags, vna_other, vna_name, vna_next = struct.unpack_from("<IHHII", data, aux)
        if cstr(vna_name) == b"GLIBC_2.35":
            print(f"patching {lib.decode()} GLIBC_2.35 (index {vna_other}) -> GLIBC_2.2.5")
            struct.pack_into("<IHHII", data, aux, target_hash, vna_flags, vna_other, target_off, vna_next)
            patched += 1
        aux += vna_next
    off += vn_next

assert patched == 1, f"expected exactly one GLIBC_2.35 entry, patched {patched}"
open(path, "wb").write(data)
os.chmod(path, 0o755)
print("wrote", path)
