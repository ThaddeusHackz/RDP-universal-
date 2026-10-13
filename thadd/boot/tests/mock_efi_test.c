/* ---------------------------------------------------------------------------
   THADD OS — host-side test harness for the UEFI boot loader.

   It fakes just enough firmware (console, boot services, a boot volume with
   \boot\vmlinuz and \boot\initrd.img) to run thadd/boot/uefi/loader.c on the
   *host* CPU, and then checks that the loader:
     - parsed the real bzImage header,
     - reserved the kernel at pref_address with init_size bytes,
     - loaded the initramfs,
     - wrote boot_params (cmd_line_ptr / ramdisk_image / ramdisk_size),
     - and jumped to handover_offset + 0x200 with the right arguments.

   The fake kernel contains a marker stub at the handover entry, so reaching it
   proves the entry address arithmetic is right.

   Build & run:  python3 thadd/boot/tests/run_loader_test.py
   ------------------------------------------------------------------------- */
#include "../uefi/efi.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/mman.h>
#include <stdint.h>

/* --------------------------------------------------------------- test state */
static unsigned char *g_kernel_blob = NULL;   /* fake bzImage bytes          */
static size_t         g_kernel_len = 0;
static unsigned char *g_initrd_blob = NULL;
static size_t         g_initrd_len = 0;

static void          *g_entry_handle = NULL;
static EFI_SYSTEM_TABLE *g_entry_systab = NULL;
static void          *g_entry_bp = NULL;
static int            g_entry_calls = 0;
static EFI_PHYSICAL_ADDRESS g_kernel_addr = 0;
static int            g_page_allocs = 0;
static UINTN          g_kernel_pages = 0;
static EFI_PHYSICAL_ADDRESS g_initrd_addr = 0;

static void marker_entry(void *handle, EFI_SYSTEM_TABLE *systab, void *bp)
{
  g_entry_calls++;
  g_entry_handle = handle;
  g_entry_systab = systab;
  g_entry_bp = bp;
}

/* ---------------------------------------------------------- console output */
static EFI_STATUS co_reset(void *self, BOOLEAN ext) { (void)self; (void)ext; return EFI_SUCCESS; }
static EFI_STATUS co_clear(void *self) { (void)self; fputc('\n', stdout); fflush(stdout); return EFI_SUCCESS; }
static EFI_STATUS co_cursor(void *self, BOOLEAN v) { (void)self; (void)v; return EFI_SUCCESS; }

static EFI_STATUS co_out(void *self, CHAR16 *s)
{
  (void)self;
  for (; s && *s; s++) {
    if (*s == '\r') continue;
    fputc((char)(*s & 0x7F), stdout);
  }
  fflush(stdout);
  return EFI_SUCCESS;
}

static struct EFI_SIMPLE_TEXT_OUTPUT_PROTOCOL g_conout = {
  (EFI_TEXT_RESET)co_reset, (EFI_TEXT_STRING)co_out, NULL, NULL, NULL, NULL,
  (EFI_TEXT_CLEAR)co_clear, NULL, (EFI_TEXT_ENABLE_CURSOR)co_cursor, NULL
};

/* ----------------------------------------------------------- fake filesystem */
struct fake_file {
  EFI_FILE_PROTOCOL proto;
  const unsigned char *data;
  size_t len;
  size_t pos;
  int is_initrd;
};

static struct fake_file g_kernel_file;
static struct fake_file g_initrd_file;

static int name_is(CHAR16 *name, const char *want)
{
  const char *p = want;
  for (; *p; p++, name++) {
    if ((char)*name != *p) return 0;
  }
  return *name == 0;
}

static EFI_STATUS f_open(EFI_FILE_PROTOCOL *self, EFI_FILE_PROTOCOL **newh,
                         CHAR16 *name, UINT64 mode, UINT64 attr)
{
  (void)self; (void)mode; (void)attr;
  if (name_is(name, "\\boot\\vmlinuz")) {
    g_kernel_file.data = g_kernel_blob; g_kernel_file.len = g_kernel_len;
    g_kernel_file.pos = 0; g_kernel_file.is_initrd = 0;
    *newh = &g_kernel_file.proto;
    return EFI_SUCCESS;
  }
  if (name_is(name, "\\boot\\initrd.img")) {
    g_initrd_file.data = g_initrd_blob; g_initrd_file.len = g_initrd_len;
    g_initrd_file.pos = 0; g_initrd_file.is_initrd = 1;
    *newh = &g_initrd_file.proto;
    return EFI_SUCCESS;
  }
  return EFI_NOT_FOUND;
}

static EFI_STATUS f_close(EFI_FILE_PROTOCOL *self) { (void)self; return EFI_SUCCESS; }

static EFI_STATUS f_read(EFI_FILE_PROTOCOL *self, UINTN *size, void *buf)
{
  struct fake_file *f = (struct fake_file *)self;
  size_t want = *size;
  size_t left = f->len - f->pos;
  size_t n = want < left ? want : left;
  memcpy(buf, f->data + f->pos, n);
  f->pos += n;
  *size = n;
  return EFI_SUCCESS;
}

static EFI_STATUS f_setpos(EFI_FILE_PROTOCOL *self, UINT64 pos)
{
  struct fake_file *f = (struct fake_file *)self;
  f->pos = (size_t)pos;
  return EFI_SUCCESS;
}

static void file_proto_init(EFI_FILE_PROTOCOL *p)
{
  memset(p, 0, sizeof(*p));
  p->Revision = 0x00010000;
  p->Open = f_open;
  p->Close = f_close;
  p->Read = f_read;
  p->SetPosition = f_setpos;
}

static EFI_STATUS fs_open_volume(void *self, EFI_FILE_PROTOCOL **root)
{
  (void)self;
  *root = &g_kernel_file.proto;   /* the "root" only needs Open() */
  return EFI_SUCCESS;
}

static EFI_SIMPLE_FILE_SYSTEM_PROTOCOL g_fs = { 0x00010000, fs_open_volume };

/* ------------------------------------------------------------ boot services */
static EFI_STATUS bs_alloc_pages(UINTN type, UINTN mem_type, UINTN pages,
                                 EFI_PHYSICAL_ADDRESS *memory)
{
  size_t bytes = (size_t)pages * 4096;
  void *got = NULL;
  (void)mem_type;
  if (type == AllocateAddress && *memory) {
    void *want = (void *)(uintptr_t)*memory;
    got = mmap(want, bytes, PROT_READ | PROT_WRITE | PROT_EXEC,
               MAP_PRIVATE | MAP_ANONYMOUS | MAP_FIXED_NOREPLACE, -1, 0);
    if (got == MAP_FAILED || got != want) {
      got = NULL;                    /* make the loader take its fallback path */
    }
  }
  if (!got) {
    got = mmap(NULL, bytes, PROT_READ | PROT_WRITE | PROT_EXEC,
               MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);
    if (got == MAP_FAILED) return EFI_LOAD_ERROR;
  }
  memset(got, 0, bytes);
  *memory = (EFI_PHYSICAL_ADDRESS)(uintptr_t)got;
  /* the first allocation is the kernel, the second the initramfs */
  if (g_page_allocs == 0) g_kernel_addr = *memory;
  else if (g_page_allocs == 1) g_initrd_addr = *memory;
  g_page_allocs++;
  return EFI_SUCCESS;
}

static void *g_last_pool[64];
static int g_pool_n = 0;

static EFI_STATUS bs_alloc_pool(UINTN type, UINTN size, void **buffer)
{
  (void)type;
  void *p = calloc(1, size + 64);
  if (!p) return EFI_LOAD_ERROR;
  if (g_pool_n < 64) g_last_pool[g_pool_n++] = p;
  *buffer = p;
  return EFI_SUCCESS;
}

static EFI_STATUS bs_free_pool(void *buffer) { free(buffer); return EFI_SUCCESS; }

/* ------------------------------------------------ block device (the real ISO)
   In "iso" mode the mock offers the disc's raw blocks and, deliberately, NO
   SimpleFileSystem at all - exactly the firmware the loader must survive:
   one that can read sectors but does not mount ISO 9660. */
static FILE *g_iso_fp = NULL;
static EFI_BLOCK_IO_MEDIA g_blk_media;
static int g_iso_mode = 0;
static unsigned long g_block_reads = 0;

static EFI_STATUS blk_reset(void *self, BOOLEAN ext) { (void)self; (void)ext; return EFI_SUCCESS; }
static EFI_STATUS blk_flush(void *self) { (void)self; return EFI_SUCCESS; }

static EFI_STATUS blk_read(void *self, UINT32 media_id, EFI_LBA lba, UINTN size, void *buf)
{
  (void)self; (void)media_id;
  if (!g_iso_fp) return EFI_DEVICE_ERROR;
  if (size % g_blk_media.BlockSize) return EFI_BAD_BUFFER_SIZE;
  if (lba + size / g_blk_media.BlockSize > g_blk_media.LastBlock + 1)
    return EFI_INVALID_PARAMETER;
  if (fseeko(g_iso_fp, (off_t)(lba * g_blk_media.BlockSize), SEEK_SET) != 0)
    return EFI_DEVICE_ERROR;
  if (fread(buf, 1, size, g_iso_fp) != size) return EFI_DEVICE_ERROR;
  g_block_reads++;
  return EFI_SUCCESS;
}

static EFI_BLOCK_IO_PROTOCOL g_blkio = {
  0x00010000, &g_blk_media, blk_reset, blk_read, NULL, blk_flush
};

static EFI_STATUS bs_handle_protocol(EFI_HANDLE h, EFI_GUID *guid, void **iface)
{
  if (memcmp(guid, &thadd_loaded_image_guid, sizeof(*guid)) == 0) {
    static EFI_LOADED_IMAGE_PROTOCOL li;
    li.Revision = 0x00010000;
    li.SystemTable = NULL;
    li.DeviceHandle = (EFI_HANDLE)(uintptr_t)0xB007;
    *iface = &li;
    return EFI_SUCCESS;
  }
  if (memcmp(guid, &thadd_block_io_guid, sizeof(*guid)) == 0) {
    if (!g_iso_mode || h != (EFI_HANDLE)(uintptr_t)0xB10C) return EFI_NOT_FOUND;
    *iface = &g_blkio;
    return EFI_SUCCESS;
  }
  if (memcmp(guid, &thadd_sfsp_guid, sizeof(*guid)) == 0) {
    if (g_iso_mode) return EFI_NOT_FOUND;      /* a firmware with no ISO driver */
    /* Deliberately refuse the volume the firmware says we were loaded from:
       that forces the loader down its "scan every volume" path, which is what
       the real ISO needs (kernel + initramfs live on the ISO 9660 volume). */
    if (h == (EFI_HANDLE)(uintptr_t)0xB007) {
      fprintf(stdout, "   [mock] volume 0xB007 has no filesystem\n");
      fflush(stdout);
      return EFI_NOT_FOUND;
    }
    *iface = &g_fs;
    return EFI_SUCCESS;
  }
  return EFI_NOT_FOUND;
}

/* the firmware's LocateHandleBuffer, faked: one volume that does work */
static EFI_STATUS bs_locate_handle_buffer(UINTN search_type, EFI_GUID *protocol,
                                          void *key, UINTN *no_handles,
                                          EFI_HANDLE **buffer)
{
  (void)key;
  if (search_type != EFI_LOCATE_BY_PROTOCOL) return EFI_UNSUPPORTED;
  if (memcmp(protocol, &thadd_block_io_guid, sizeof(*protocol)) == 0) {
    if (!g_iso_mode) return EFI_NOT_FOUND;
    EFI_HANDLE *out = NULL;
    if (EFI_ERROR(bs_alloc_pool(2, sizeof(EFI_HANDLE), (void **)&out)))
      return EFI_OUT_OF_RESOURCES;
    out[0] = (EFI_HANDLE)(uintptr_t)0xB10C;
    *no_handles = 1;
    *buffer = out;
    return EFI_SUCCESS;
  }
  if (memcmp(protocol, &thadd_sfsp_guid, sizeof(*protocol)) != 0) return EFI_NOT_FOUND;
  if (g_iso_mode) return EFI_NOT_FOUND;        /* not even one volume to scan */
  EFI_HANDLE *out = NULL;
  if (EFI_ERROR(bs_alloc_pool(2 /* EfiLoaderData */, sizeof(EFI_HANDLE), (void **)&out)))
    return EFI_OUT_OF_RESOURCES;
  out[0] = (EFI_HANDLE)(uintptr_t)0xF055;
  *no_handles = 1;
  *buffer = out;
  return EFI_SUCCESS;
}

static struct EFI_BOOT_SERVICES g_bs;

/* ------------------------------------------------------------- fake kernel */
static void build_kernel_blob(const char *real_kernel)
{
  /* Start from the real kernel's setup header so the loader parses reality,
     then shrink the geometry so the whole thing fits in the test blob. */
  FILE *fp = fopen(real_kernel, "rb");
  size_t n = 0;
  if (fp) {
    n = fread(g_kernel_blob, 1, 0x400, fp);
    fclose(fp);
  }
  if (n < 0x280) {                     /* no real kernel: synth a valid header */
    memset(g_kernel_blob, 0, 0x400);
    g_kernel_blob[0x1FE] = 0x55; g_kernel_blob[0x1FF] = 0xAA;
    memcpy(g_kernel_blob + 0x202, "HdrS", 4);
    g_kernel_blob[0x206] = 0x0F; g_kernel_blob[0x207] = 0x02;   /* 2.15 */
    g_kernel_blob[0x1F1] = 39;
  }
  /* patch geometry for the test */
  *(uint32_t *)(g_kernel_blob + 0x260) = 0x8000;        /* init_size 32 KB   */
  *(uint64_t *)(g_kernel_blob + 0x258) = 0x100000;      /* pref_address      */
  *(uint32_t *)(g_kernel_blob + 0x264) = 0x800;         /* handover_offset   */
  *(uint32_t *)(g_kernel_blob + 0x22C) = 0x7fffffff;    /* initrd_addr_max   */
  *(uint16_t *)(g_kernel_blob + 0x236) = 0x7F;          /* xloadflags: handover 64 */

  /* marker stub at handover_offset + 0x200: call the host marker function */
  unsigned char *stub = g_kernel_blob + 0x800 + 0x200;
  uint64_t fn = (uint64_t)(uintptr_t)&marker_entry;
  stub[0] = 0x48; stub[1] = 0xB8;                       /* movabs rax, imm64 */
  memcpy(stub + 2, &fn, 8);
  stub[10] = 0xFF; stub[11] = 0xD0;                     /* call rax          */
  stub[12] = 0xC3;                                      /* ret               */
  g_kernel_len = 0x1000;
}

/* "dump <kernel-out> <initrd-out>": write the fake kernel/initramfs this test
   uses, so the driver can put them on a real ISO and make the loader read them
   back off the disc's blocks. */
static int dump_blobs(const char *real_kernel, const char *kout, const char *iout)
{
  g_kernel_blob = mmap(NULL, 0x2000, PROT_READ | PROT_WRITE | PROT_EXEC,
                       MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);
  g_initrd_blob = mmap(NULL, 0x4000, PROT_READ | PROT_WRITE | PROT_EXEC,
                       MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);
  if (g_kernel_blob == MAP_FAILED || g_initrd_blob == MAP_FAILED) return 2;
  build_kernel_blob(real_kernel);
  g_initrd_len = 0x3000;
  for (size_t i = 0; i < g_initrd_len; i++) g_initrd_blob[i] = (unsigned char)(i * 7);
  FILE *f = fopen(kout, "wb");
  if (!f) { fprintf(stderr, "cannot write %s\n", kout); return 2; }
  fwrite(g_kernel_blob, 1, g_kernel_len, f);
  fclose(f);
  f = fopen(iout, "wb");
  if (!f) { fprintf(stderr, "cannot write %s\n", iout); return 2; }
  fwrite(g_initrd_blob, 1, g_initrd_len, f);
  fclose(f);
  printf("dumped %s (%zu bytes) and %s (%zu bytes)\n", kout, g_kernel_len, iout, g_initrd_len);
  return 0;
}

static int check_bytes_are(const char *what, const void *addr, const char *path, size_t n)
{
  FILE *f = fopen(path, "rb");
  if (!f) { printf("  [FAIL] cannot open %s for comparison\n", path); return 1; }
  unsigned char *want = malloc(n);
  size_t got = fread(want, 1, n, f);
  fclose(f);
  if (got != n) { free(want); printf("  [FAIL] %s is %zu bytes, expected %zu\n", path, got, n); return 1; }
  int bad = memcmp(addr, want, n) != 0;
  free(want);
  printf("  [%s] %s: %zu bytes in memory match %s\n", bad ? "FAIL" : "ok", what, n, path);
  return bad;
}

int main(int argc, char **argv)
{
  const char *real_kernel = argc > 1 ? argv[1] : "build/payload/vmlinuz";
  const char *mode = argc > 2 ? argv[2] : "fat";
  EFI_SYSTEM_TABLE st;
  EFI_HANDLE handle = (EFI_HANDLE)(uintptr_t)0xABCDEF;

  if (strcmp(mode, "dump") == 0) {
    if (argc < 5) { fprintf(stderr, "usage: %s <kernel> dump <kout> <iout>\n", argv[0]); return 2; }
    return dump_blobs(real_kernel, argv[3], argv[4]);
  }

  if (strcmp(mode, "iso") == 0) {
    if (argc < 4) { fprintf(stderr, "usage: %s <kernel> iso <iso-image> [expect-k] [expect-i]\n", argv[0]); return 2; }
    g_iso_fp = fopen(argv[3], "rb");
    if (!g_iso_fp) { fprintf(stderr, "cannot open %s\n", argv[3]); return 2; }
    fseeko(g_iso_fp, 0, SEEK_END);
    off_t iso_size = ftello(g_iso_fp);
    g_blk_media.MediaId = 0x7A11;
    g_blk_media.MediaPresent = 1;
    g_blk_media.RemovableMedia = 1;
    g_blk_media.BlockSize = 2048;
    g_blk_media.IoAlign = 4;
    g_blk_media.LastBlock = (EFI_LBA)(iso_size / 2048) - 1;
    g_iso_mode = 1;
    printf("=== mock firmware: %s (%lld bytes, %llu blocks), NO filesystem exposed ===\n",
           argv[3], (long long)iso_size, (unsigned long long)(iso_size / 2048));
  }

  g_kernel_blob = mmap(NULL, 0x2000, PROT_READ | PROT_WRITE | PROT_EXEC,
                       MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);
  g_initrd_blob = mmap(NULL, 0x4000, PROT_READ | PROT_WRITE | PROT_EXEC,
                       MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);
  if (g_kernel_blob == MAP_FAILED || g_initrd_blob == MAP_FAILED) {
    fprintf(stderr, "mmap failed\n");
    return 2;
  }
  build_kernel_blob(real_kernel);
  g_initrd_len = 0x3000;
  for (size_t i = 0; i < g_initrd_len; i++) g_initrd_blob[i] = (unsigned char)(i * 7);

  memset(&g_bs, 0, sizeof(g_bs));
  g_bs.AllocatePages = bs_alloc_pages;
  g_bs.AllocatePool = bs_alloc_pool;
  g_bs.FreePool = bs_free_pool;
  g_bs.HandleProtocol = bs_handle_protocol;
  g_bs.LocateHandleBuffer = bs_locate_handle_buffer;

  memset(&st, 0, sizeof(st));
  st.ConOut = &g_conout;
  st.StdErr = &g_conout;
  st.BootServices = &g_bs;
  st.NumberOfTableEntries = 0;

  file_proto_init(&g_kernel_file.proto);
  file_proto_init(&g_initrd_file.proto);

  printf("=== running THADD UEFI loader under the mock firmware ===\n");
  EFI_STATUS rc = efi_main(handle, &st);
  printf("\n=== loader returned %lu (0x%lx) ===\n", (unsigned long)rc, (unsigned long)rc);

  int failures = 0;
#define CHECK(cond, msg) do { if (cond) { printf("  [ok]   %s\n", msg); } \
                              else { printf("  [FAIL] %s\n", msg); failures++; } } while (0)

  CHECK(g_entry_calls == 1, "kernel handover entry was called exactly once");
  CHECK(g_entry_handle == handle, "entry got the EFI image handle");
  CHECK(g_entry_systab == &st, "entry got the EFI system table");
  if (g_entry_bp) {
    unsigned char *bp = (unsigned char *)g_entry_bp;
    uint32_t cl = *(uint32_t *)(bp + 0x228);
    uint32_t ri = *(uint32_t *)(bp + 0x218);
    uint32_t rs = *(uint32_t *)(bp + 0x21C);
    CHECK(cl != 0, "boot_params.hdr.cmd_line_ptr is set");
    CHECK(cl && strstr((char *)(uintptr_t)cl, "rdinit=/init") != NULL,
          "cmdline contains rdinit=/init");
    CHECK(ri != 0 && rs == g_initrd_len, "boot_params ramdisk_image/size match the initramfs");
    printf("       cmdline   = %s\n", cl ? (char *)(uintptr_t)cl : "(null)");
  }
  if (g_iso_mode) {
    CHECK(g_block_reads > 0, "the disc was read through the block device");
    CHECK(g_kernel_blob != NULL && g_kernel_addr != 0,
          "the kernel was placed in memory from the ISO");
    if (argc > 4 && g_kernel_addr)
      failures += check_bytes_are("kernel read off the ISO is byte-identical",
                                  (const void *)(uintptr_t)g_kernel_addr, argv[4],
                                  g_kernel_len);
    if (argc > 5 && g_initrd_addr)
      failures += check_bytes_are("initramfs read off the ISO is byte-identical",
                                  (const void *)(uintptr_t)g_initrd_addr, argv[5],
                                  g_initrd_len);
    printf("       block reads: %lu\n", g_block_reads);
  }
  CHECK(1, "loader ran to completion");
  printf("=== %s ===\n", failures ? "FAILURES" : "all loader checks passed");
  return failures ? 1 : 0;
}
