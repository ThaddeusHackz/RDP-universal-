/* ---------------------------------------------------------------------------
   THADD OS — UEFI boot loader (freestanding PE32+ EFI application).

   What it does, in order:
     1. find the volume the firmware loaded us from (SimpleFileSystem)
     2. read \boot\vmlinuz   -> allocated at the kernel's pref_address,
                                reserving hdr.init_size (decompressor space)
     3. read \boot\initrd.img-> allocated below initrd_addr_max
     4. build a zeroed struct boot_params with cmdline + ramdisk fields
     5. jump to the kernel's EFI handover entry point:
            boot_params.hdr.handover_offset + 0x200   (64-bit handover)

   The kernel's own EFI stub then calls ExitBootServices and starts Linux,
   so this loader never touches the memory map.  Everything is printed to the
   firmware console so a failure is visible instead of a black screen.

   Build: thadd/boot/build_bootloaders.py   (gcc + ld -mi386pep)
   ------------------------------------------------------------------------- */
#include "efi.h"

typedef struct {
  unsigned char  pad[0x1000];
} thadd_page;

/* ------------------------------------------------------------------ helpers */
static void *t_memcpy(void *dst, const void *src, UINTN n)
{
  UINT8 *d = (UINT8 *)dst;
  const UINT8 *s = (const UINT8 *)src;
  while (n--) *d++ = *s++;
  return dst;
}

static void *t_memset(void *dst, int c, UINTN n)
{
  UINT8 *d = (UINT8 *)dst;
  while (n--) *d++ = (UINT8)c;
  return dst;
}

static UINTN t_strlen(const char *s)
{
  UINTN n = 0;
  while (s[n]) n++;
  return n;
}

static void print(EFI_SYSTEM_TABLE *st, const char *s)
{
  CHAR16 buf[256];
  UINTN i = 0;
  if (!st || !st->ConOut) return;
  while (*s && i < 250) {
    if (*s == '\n') { buf[i++] = '\r'; }
    buf[i++] = (CHAR16)(unsigned char)*s++;
  }
  buf[i] = 0;
  st->ConOut->OutputString(st->ConOut, buf);
}

static void print_num(EFI_SYSTEM_TABLE *st, UINT64 v)
{
  char tmp[24];
  int i = 0;
  if (!v) { print(st, "0"); return; }
  while (v && i < 20) { tmp[i++] = (char)('0' + (v % 10)); v /= 10; }
  while (i--) print(st, (char[]){ tmp[i], 0 });
}

static void print_hex(EFI_SYSTEM_TABLE *st, UINT64 v)
{
  const char *digits = "0123456789ABCDEF";
  char buf[19];
  int i;
  buf[0] = '0'; buf[1] = 'x';
  for (i = 0; i < 16; i++) buf[2 + i] = digits[(v >> ((15 - i) * 4)) & 0xF];
  buf[18] = 0;
  print(st, buf);
}

/* ------------------------------------------------------------------- reading */
static EFI_STATUS open_file(EFI_FILE_PROTOCOL *root, CHAR16 *name, EFI_FILE_PROTOCOL **out)
{
  return root->Open(root, out, name, EFI_FILE_MODE_READ, 0);
}

/* read a whole file into dst (must be large enough); returns bytes read */
static EFI_STATUS read_into(EFI_FILE_PROTOCOL *f, void *dst, UINTN max, UINTN *got)
{
  UINTN total = 0;
  while (total < max) {
    UINTN want = max - total;
    if (want > (1024 * 1024)) want = 1024 * 1024;
    EFI_STATUS s = f->Read(f, &want, (UINT8 *)dst + total);
    if (EFI_ERROR(s)) return s;
    if (want == 0) break;              /* end of file */
    total += want;
  }
  *got = total;
  return EFI_SUCCESS;
}

/* count a file's size without keeping it */
static EFI_STATUS size_of(EFI_FILE_PROTOCOL *f, UINTN *size, void *scratch, UINTN scratch_len)
{
  UINTN total = 0;
  EFI_STATUS s;
  for (;;) {
    UINTN want = scratch_len;
    s = f->Read(f, &want, scratch);
    if (EFI_ERROR(s)) return s;
    total += want;
    if (want == 0) break;
  }
  *size = total;
  s = f->SetPosition(f, 0);
  return s;
}

/* ------------------------------------------------------- setup header probe */
struct hdr_view {
  UINT8  setup_sects;
  UINT8  relocatable;
  UINT16 xloadflags;
  UINT32 init_size;
  UINT32 handover_offset;
  UINT64 pref_address;
  UINT16 version;
  UINT8  loadflags;
  UINT32 code32_start;
  UINT32 initrd_addr_max;
};

static int parse_header(const UINT8 *d, UINTN len, struct hdr_view *h)
{
  if (len < 0x270) return 0;
  if (d[0x1FE] != 0x55 || d[0x1FF] != 0xAA) return 0;
  if (d[0x202] != 'H' || d[0x203] != 'd' || d[0x204] != 'r' || d[0x205] != 'S') return 0;
  h->setup_sects     = d[0x1F1];
  h->loadflags       = d[0x211];
  h->code32_start    = *(UINT32 *)(d + 0x214);
  h->relocatable     = d[0x234];
  h->xloadflags      = *(UINT16 *)(d + 0x236);
  h->version         = *(UINT16 *)(d + 0x206);
  h->init_size       = *(UINT32 *)(d + 0x260);
  h->pref_address    = *(UINT64 *)(d + 0x258);
  h->handover_offset = *(UINT32 *)(d + 0x264);
  h->initrd_addr_max = *(UINT32 *)(d + 0x22C);
  return 1;
}

#define XLF_EFI_HANDOVER_64 (1 << 3)

typedef void (*efi_stub_entry_t)(void *handle, EFI_SYSTEM_TABLE *table, void *boot_params);

/* -------------------------------------------- find a file on *any* volume
   The El Torito boot image must stay under 32 MB (its size is a 16-bit field
   in sectors of 512 bytes in the boot catalog), so the FAT volume only carries
   this loader.  The kernel and the initramfs live on the ISO 9660 volume, which
   the firmware also exposes as a SimpleFileSystem - search every volume. */
static EFI_STATUS open_any_volume(EFI_BOOT_SERVICES *bs, CHAR16 *name,
                                  EFI_FILE_PROTOCOL **out)
{
  EFI_HANDLE *buf = NULL;
  UINTN count = 0;

  if (!bs->LocateHandleBuffer) return EFI_NOT_FOUND;
  EFI_STATUS s = bs->LocateHandleBuffer(EFI_LOCATE_BY_PROTOCOL, &thadd_sfsp_guid,
                                        NULL, &count, &buf);
  if (EFI_ERROR(s) || !buf || !count) return EFI_NOT_FOUND;

  for (UINTN i = 0; i < count; i++) {
    EFI_SIMPLE_FILE_SYSTEM_PROTOCOL *fs = NULL;
    EFI_FILE_PROTOCOL *root = NULL;
    if (EFI_ERROR(bs->HandleProtocol(buf[i], &thadd_sfsp_guid, (void **)&fs)) || !fs)
      continue;
    if (EFI_ERROR(fs->OpenVolume(fs, &root)) || !root) continue;
    if (!EFI_ERROR(open_file(root, name, out))) {
      bs->FreePool(buf);
      return EFI_SUCCESS;
    }
  }
  bs->FreePool(buf);
  return EFI_NOT_FOUND;
}

static EFI_STATUS find_file(EFI_BOOT_SERVICES *bs, EFI_FILE_PROTOCOL *root,
                            CHAR16 *name, EFI_FILE_PROTOCOL **out)
{
  if (root && !EFI_ERROR(open_file(root, name, out))) return EFI_SUCCESS;
  return open_any_volume(bs, name, out);
}


/* ====================================================== ISO 9660, raw blocks
   Firmware usually mounts a FAT ESP as a filesystem, but *not* every firmware
   mounts a CD's ISO 9660 volume - and this disc keeps its kernel and initramfs
   on the ISO 9660 filesystem (the El Torito boot image is capped at 32 MB by
   its 16-bit sector count).  So the files are readable two ways:
     (a) through any SimpleFileSystem volume, and
     (b) straight off the device's blocks, with the ISO 9660 reader below.
   (b) needs nothing from the firmware but ReadBlocks. */

#define ISO_BLOCK 2048

static UINT32 le32(const UINT8 *p)
{
  return (UINT32)p[0] | ((UINT32)p[1] << 8) | ((UINT32)p[2] << 16) | ((UINT32)p[3] << 24);
}

/* Read `bytes` (any size) starting at 2048-byte block `lba`. */
static EFI_STATUS iso_read(EFI_BLOCK_IO_PROTOCOL *bio, UINT64 lba, void *buf, UINTN bytes)
{
  UINT32 bs = (bio->Media && bio->Media->BlockSize) ? bio->Media->BlockSize : ISO_BLOCK;
  UINT32 mid = bio->Media ? bio->Media->MediaId : 0;
  static UINT8 __attribute__((aligned(16))) tmp[4096];
  UINT8 *out = (UINT8 *)buf;
  UINTN left = bytes;
  UINT64 cur = lba;

  if (bs > sizeof(tmp)) return EFI_BAD_BUFFER_SIZE;
  while (left) {
    EFI_STATUS s = bio->ReadBlocks(bio, mid, cur, bs, tmp);
    if (EFI_ERROR(s)) return s;
    UINTN n = (left < bs) ? left : bs;
    t_memcpy(out, tmp, n);
    out += n;
    left -= n;
    cur++;
  }
  return EFI_SUCCESS;
}

/* Compare an ISO directory-entry name with a wanted name: the ";1" version
   suffix, a trailing dot and letter case are all ignored. */
static int iso_name_eq(const UINT8 *name, UINTN len, CHAR16 *want)
{
  char got[72];
  UINTN n = 0;
  for (UINTN i = 0; i < len && n < sizeof(got) - 1; i++) {
    char c = (char)name[i];
    if (c == ';') break;
    got[n++] = c;
  }
  while (n && (got[n - 1] == '.' || got[n - 1] == ' ')) n--;
  got[n] = 0;

  UINTN w = 0;
  while (want[w]) w++;
  if (w != n) return 0;
  for (UINTN i = 0; i < n; i++) {
    char a = got[i], b = (char)want[i];
    if (a >= 'a' && a <= 'z') a = (char)(a - 32);
    if (b >= 'a' && b <= 'z') b = (char)(b - 32);
    if (a != b) return 0;
  }
  return 1;
}

/* Find one name inside one directory record; returns the new record (34 bytes). */
static EFI_STATUS iso_dir_lookup(EFI_BLOCK_IO_PROTOCOL *bio, const UINT8 *dir_rec,
                                 CHAR16 *want, UINT8 *out_rec)
{
  UINT64 lba = le32(dir_rec + 2);
  UINT64 size = le32(dir_rec + 10);
  static UINT8 __attribute__((aligned(16))) blk[ISO_BLOCK];
  UINT64 done = 0;

  while (done < size) {
    EFI_STATUS s = iso_read(bio, lba + done / ISO_BLOCK, blk, ISO_BLOCK);
    if (EFI_ERROR(s)) return s;
    UINTN off = 0;
    while (off + 33 < ISO_BLOCK) {
      UINT8 rl = blk[off];
      if (rl == 0) break;                       /* padding to the end of the block */
      if ((UINTN)rl < 34 || off + rl > ISO_BLOCK) break;
      UINT8 nl = blk[off + 32];
      const UINT8 *nm = blk + off + 33;
      int special = (nl == 1 && (nm[0] == 0x00 || nm[0] == 0x01));
      if (!special && iso_name_eq(nm, nl, want)) {
        t_memcpy(out_rec, blk + off, 34);
        return EFI_SUCCESS;
      }
      off += rl;
    }
    done += ISO_BLOCK;
  }
  return EFI_NOT_FOUND;
}

/* Search every block device for an ISO 9660 volume that holds `wanted`. */
static EFI_STATUS iso_find(EFI_BOOT_SERVICES *bs, CHAR16 *wanted, EFI_SYSTEM_TABLE *st,
                           EFI_BLOCK_IO_PROTOCOL **bio_out, UINT64 *lba_out,
                           UINT64 *size_out, char *label_out, UINTN label_len)
{
  EFI_HANDLE *buf = NULL;
  UINTN count = 0;

  if (!bs->LocateHandleBuffer) return EFI_NOT_FOUND;
  EFI_STATUS s = bs->LocateHandleBuffer(EFI_LOCATE_BY_PROTOCOL, &thadd_block_io_guid,
                                        NULL, &count, &buf);
  if (EFI_ERROR(s) || !buf || !count) return EFI_NOT_FOUND;

  static UINT8 __attribute__((aligned(16))) pvd[ISO_BLOCK];
  for (UINTN i = 0; i < count; i++) {
    EFI_BLOCK_IO_PROTOCOL *bio = NULL;
    if (EFI_ERROR(bs->HandleProtocol(buf[i], &thadd_block_io_guid, (void **)&bio)) || !bio)
      continue;
    if (!bio->Media || !bio->Media->MediaPresent || bio->Media->LogicalPartition)
      continue;
    if (EFI_ERROR(iso_read(bio, 16, pvd, ISO_BLOCK))) continue;
    if (pvd[0] != 1) continue;
    if (!(pvd[1] == 'C' && pvd[2] == 'D' && pvd[3] == '0' && pvd[4] == '0' && pvd[5] == '1'))
      continue;

    UINT8 cur[34];
    UINT8 n = pvd[156];
    if (n < 34 || n > 60) continue;
    t_memcpy(cur, pvd + 156, 34);

    CHAR16 *p = wanted;
    while (*p == '\\' || *p == '/') p++;
    int ok = 1;
    while (*p) {
      CHAR16 comp[64];
      UINTN cl = 0;
      while (*p && *p != '\\' && *p != '/' && cl < 63) comp[cl++] = *p++;
      comp[cl] = 0;
      while (*p == '\\' || *p == '/') p++;
      UINT8 next[34];
      if (EFI_ERROR(iso_dir_lookup(bio, cur, comp, next))) { ok = 0; break; }
      t_memcpy(cur, next, 34);
    }
    if (!ok) continue;
    if (cur[25] & 0x02) continue;                 /* directory, not a file */

    if (label_out && label_len) {
      UINTN j = 0;
      for (; j + 1 < label_len && j < 32; j++) label_out[j] = (char)pvd[40 + j];
      while (j && label_out[j - 1] == ' ') j--;
      label_out[j] = 0;
    }
    *bio_out = bio;
    *lba_out = le32(cur + 2);
    *size_out = le32(cur + 10);
    bs->FreePool(buf);
    if (st) print(st, "  reading  : the ISO 9660 filesystem on the disc itself\n");
    return EFI_SUCCESS;
  }
  bs->FreePool(buf);
  return EFI_NOT_FOUND;
}

/* ------------------------------------------------------------- file sources
   One "src" is either an open firmware file, or a file located on the ISO. */
struct fsource {
  EFI_FILE_PROTOCOL *f;
  EFI_BLOCK_IO_PROTOCOL *bio;
  UINT64 iso_lba;
  UINT64 size;
  UINT64 pos;
  int is_iso;
};

static EFI_STATUS src_open(EFI_BOOT_SERVICES *bs, EFI_FILE_PROTOCOL *root, CHAR16 *name,
                           struct fsource *src, EFI_SYSTEM_TABLE *st)
{
  EFI_FILE_PROTOCOL *f = NULL;
  t_memset(src, 0, sizeof(*src));
  if (!EFI_ERROR(find_file(bs, root, name, &f)) && f) {
    src->f = f;
    return EFI_SUCCESS;
  }
  char label[36];
  t_memset(label, 0, sizeof(label));
  EFI_BLOCK_IO_PROTOCOL *bio = NULL;
  UINT64 lba = 0, size = 0;
  if (!EFI_ERROR(iso_find(bs, name, st, &bio, &lba, &size, label, sizeof(label)))) {
    src->bio = bio;
    src->iso_lba = lba;
    src->size = size;
    src->is_iso = 1;
    if (st && label[0]) { print(st, "  volume   : ISO 9660 label \""); print(st, label); print(st, "\"\n"); }
    return EFI_SUCCESS;
  }
  return EFI_NOT_FOUND;
}

static EFI_STATUS src_size(struct fsource *src, UINTN *size, void *scratch, UINTN scratch_len)
{
  if (src->is_iso) { *size = (UINTN)src->size; src->pos = 0; return EFI_SUCCESS; }
  return size_of(src->f, size, scratch, scratch_len);
}

static EFI_STATUS src_read(struct fsource *src, void *dst, UINTN max, UINTN *got)
{
  if (src->is_iso) {
    UINT64 left = (src->size > src->pos) ? (src->size - src->pos) : 0;
    UINTN n = (UINTN)(left < max ? left : max);
    if (n) {
      EFI_STATUS s = iso_read(src->bio, src->iso_lba + src->pos / ISO_BLOCK, dst, n);
      if (EFI_ERROR(s)) return s;
    }
    src->pos += n;
    *got = n;
    return EFI_SUCCESS;
  }
  UINTN want = max;
  EFI_STATUS s = src->f->Read(src->f, &want, dst);
  *got = want;
  return s;
}

static EFI_STATUS src_rewind(struct fsource *src)
{
  if (src->is_iso) { src->pos = 0; return EFI_SUCCESS; }
  return src->f->SetPosition(src->f, 0);
}

static void src_close(struct fsource *src)
{
  if (src->f) { src->f->Close(src->f); src->f = NULL; }
}

/* Read a whole file into a fixed destination. */
static EFI_STATUS src_read_all(struct fsource *src, void *dst, UINTN size, UINTN *got)
{
  UINTN total = 0;
  while (total < size) {
    UINTN want = size - total;
    UINTN n = 0;
    EFI_STATUS s = src_read(src, (UINT8 *)dst + total, want, &n);
    if (EFI_ERROR(s)) return s;
    if (n == 0) break;
    total += n;
  }
  *got = total;
  return EFI_SUCCESS;
}

/* --------------------------------------------------------------------- main */
EFI_STATUS efi_main(EFI_HANDLE image_handle, EFI_SYSTEM_TABLE *st)
{
  EFI_BOOT_SERVICES *bs = st->BootServices;
  EFI_LOADED_IMAGE_PROTOCOL *li = NULL;
  EFI_SIMPLE_FILE_SYSTEM_PROTOCOL *fs = NULL;
  EFI_FILE_PROTOCOL *root = NULL, *file = NULL;
  EFI_STATUS s;
  UINTN i;

  st->ConOut->EnableCursor(st->ConOut, 0);
  st->ConOut->ClearScreen(st->ConOut);
  print(st, "\n  THADD OS 1.0 (Nebula Prime) - UEFI loader\n");
  print(st, "  ----------------------------------------\n\n");

  s = bs->HandleProtocol(image_handle, &thadd_loaded_image_guid, (void **)&li);
  if (EFI_ERROR(s) || !li) { print(st, "[!] no loaded-image protocol\n"); return s; }
  s = bs->HandleProtocol(li->DeviceHandle, &thadd_sfsp_guid, (void **)&fs);
  if (!EFI_ERROR(s) && fs && !EFI_ERROR(fs->OpenVolume(fs, &root)) && root) {
    print(st, "  volume   : the volume we were loaded from\n");
  } else {
    root = NULL;
    print(st, "  volume   : scanning every volume for the disc\n");
  }

  /* ---------------------------------------------------------------- kernel */
  struct fsource ksrc;
  s = src_open(bs, root, L"\\boot\\vmlinuz", &ksrc, st);
  if (EFI_ERROR(s)) {
    print(st, "[!] \\boot\\vmlinuz not found on any volume\n");
    return s;
  }

  UINT8 probe[0x400];
  UINTN got = 0;
  s = src_read(&ksrc, probe, sizeof(probe), &got);
  if (EFI_ERROR(s) || got < 0x280) { print(st, "[!] cannot read kernel header\n"); return s; }
  src_rewind(&ksrc);

  struct hdr_view h;
  if (!parse_header(probe, sizeof(probe), &h)) {
    print(st, "[!] not a Linux bzImage (no HdrS / 0xAA55)\n");
    return EFI_LOAD_ERROR;
  }
  print(st, "  kernel   : Linux bzImage, protocol 2.");
  print_num(st, (h.version & 0xF) + ((h.version >> 4) & 0xF) * 10);
  print(st, ", setup ");
  print_num(st, (UINT64)(h.setup_sects + 1) * 512);
  print(st, " bytes\n");

  UINTN ksize = 0;
  UINT8 *scratch = NULL;
  s = bs->AllocatePool(EfiLoaderData, 1024 * 1024, (void **)&scratch);
  if (EFI_ERROR(s)) { print(st, "[!] out of memory (scratch)\n"); return s; }
  s = src_size(&ksrc, &ksize, scratch, 1024 * 1024);
  if (EFI_ERROR(s) || !ksize) { print(st, "[!] cannot size the kernel\n"); return s; }

  UINT64 need = h.init_size ? h.init_size : ksize;
  if (need < ksize) need = ksize;
  UINTN kpages = (UINTN)((need + 0xFFF) / 0x1000);
  UINT64 kaddr = h.pref_address ? h.pref_address : 0x100000;
  EFI_PHYSICAL_ADDRESS kb = (EFI_PHYSICAL_ADDRESS)kaddr;
  s = bs->AllocatePages(AllocateAddress, EfiLoaderData, kpages, &kb);
  if (EFI_ERROR(s)) {
    /* kernel is relocatable: fall back to any 2 MB aligned block */
    kb = 0;
    s = bs->AllocatePages(AllocateAnyPages, EfiLoaderData, kpages, &kb);
    if (EFI_ERROR(s)) { print(st, "[!] cannot reserve kernel memory\n"); return s; }
  }
  src_rewind(&ksrc);
  UINTN kread = 0;
  s = src_read_all(&ksrc, (void *)kb, ksize, &kread);
  if (EFI_ERROR(s) || kread != ksize) { print(st, "[!] short read on the kernel\n"); return EFI_LOAD_ERROR; }
  src_close(&ksrc);
  print(st, "  placed   : ");
  print_num(st, (UINT64)kpages * 4096);
  print(st, " bytes of kernel + decompressor space at ");
  print_hex(st, kb);
  print(st, "\n");

  if (!(h.xloadflags & XLF_EFI_HANDOVER_64) || !h.handover_offset) {
    print(st, "[!] this kernel has no 64-bit EFI handover entry\n");
    return EFI_UNSUPPORTED;
  }
  UINT64 entry_addr = kb + h.handover_offset + 0x200;
  print(st, "  entry    : handover +0x200 at ");
  print_hex(st, entry_addr);
  print(st, "\n");

  /* ---------------------------------------------------------------- initrd */
  UINT64 initrd_addr = 0, initrd_size = 0;
  struct fsource isrc;
  s = src_open(bs, root, L"\\boot\\initrd.img", &isrc, st);
  if (!EFI_ERROR(s)) {
    UINTN isize = 0;
    s = src_size(&isrc, &isize, scratch, 1024 * 1024);
    if (EFI_ERROR(s) || !isize) { print(st, "[!] cannot size the initramfs\n"); return s; }
    UINTN ipages = (isize + 0xFFF) / 0x1000 + 1;
    EFI_PHYSICAL_ADDRESS ib = 0;
    /* the kernel tells us where it is willing to find the initramfs */
    if (h.initrd_addr_max && h.initrd_addr_max < 0xFFFFFFFFULL) {
      ib = (EFI_PHYSICAL_ADDRESS)(h.initrd_addr_max & ~0xFFFULL);
      s = bs->AllocatePages(AllocateMaxAddress, EfiLoaderData, ipages, &ib);
    } else {
      s = bs->AllocatePages(AllocateAnyPages, EfiLoaderData, ipages, &ib);
    }
    if (EFI_ERROR(s)) {
      ib = 0;
      s = bs->AllocatePages(AllocateAnyPages, EfiLoaderData, ipages, &ib);
    }
    if (EFI_ERROR(s)) { print(st, "[!] cannot reserve initramfs memory\n"); return s; }
    src_rewind(&isrc);
    UINTN iread = 0;
    s = src_read_all(&isrc, (void *)ib, isize, &iread);
    if (EFI_ERROR(s) || iread != isize) { print(st, "[!] short read on the initramfs\n"); return EFI_LOAD_ERROR; }
    src_close(&isrc);
    initrd_addr = ib;
    initrd_size = isize;
    print(st, "  initramfs: ");
    print_num(st, initrd_size);
    print(st, " bytes at ");
    print_hex(st, initrd_addr);
    print(st, "\n");
  } else {
    print(st, "[!] \\boot\\initrd.img missing - continuing without it\n");
  }

  /* --------------------------------------------------------------- cmdline */
  static const char cmdline[] =
    "console=tty0 console=ttyS0,115200 rdinit=/init loglevel=4 quiet "
    "tp_printk=off thadd=live rd.udev.log_level=3";
  UINTN clen = t_strlen(cmdline) + 1;
  void *cbuf = NULL;
  s = bs->AllocatePool(EfiLoaderData, clen + 16, &cbuf);
  if (EFI_ERROR(s)) { print(st, "[!] cannot allocate cmdline\n"); return s; }
  t_memcpy(cbuf, cmdline, clen);

  void *bp_raw = NULL;
  s = bs->AllocatePool(EfiLoaderData, 4096, &bp_raw);   /* struct boot_params */
  if (EFI_ERROR(s)) { print(st, "[!] cannot allocate boot_params\n"); return s; }
  t_memset(bp_raw, 0, 4096);
  UINT8 *bp = (UINT8 *)bp_raw;

  *(UINT32 *)(bp + 0x228) = (UINT32)(UINTN)cbuf;          /* hdr.cmd_line_ptr   */
  if (initrd_addr) {
    /* ramdisk_image / ramdisk_size live at 0x218 / 0x21C */
    *(UINT32 *)(bp + 0x218) = (UINT32)initrd_addr;
    *(UINT32 *)(bp + 0x21C) = (UINT32)initrd_size;
    if (initrd_addr > 0xFFFFFFFFULL)
      *(UINT32 *)(bp + 0x0C0) = (UINT32)(initrd_addr >> 32); /* ext_ramdisk_image */
  }

  print(st, "\n  cmdline  : ");
  print(st, cmdline);
  print(st, "\n  booting Linux...\n");

  /* leave the loader: the kernel's EFI stub takes over from here */
  efi_stub_entry_t entry = (efi_stub_entry_t)(UINTN)entry_addr;
  entry(image_handle, st, bp);

  /* only reached if the kernel refused to start */
  print(st, "\n[!] the kernel returned instead of booting\n");
  for (i = 0; i < 10000000; i++) { }
  return EFI_LOAD_ERROR;
}
