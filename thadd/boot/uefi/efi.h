/* ---------------------------------------------------------------------------
   THADD OS — minimal UEFI definitions (no EDK2, no libc).
   Only what the THADD boot loader needs, in the order the UEFI 2.x spec
   defines them.  Everything is freestanding: plain C, no headers.
   ------------------------------------------------------------------------- */
#ifndef THADD_EFI_H
#define THADD_EFI_H

typedef unsigned char      UINT8;
typedef unsigned short     UINT16;
typedef unsigned int       UINT32;
typedef unsigned long long UINT64;
typedef signed long long   INT64;
typedef unsigned long      UINTN;      /* x86_64: 64-bit */
typedef UINTN              EFI_STATUS;
typedef UINTN              EFI_PHYSICAL_ADDRESS;
typedef void              *EFI_HANDLE;
typedef void              *EFI_EVENT;
typedef unsigned short     CHAR16;
typedef unsigned char      BOOLEAN;

#define EFI_SUCCESS            0UL
#define EFI_LOAD_ERROR         1UL
#define EFI_INVALID_PARAMETER  2UL
#define EFI_UNSUPPORTED        3UL
#define EFI_BAD_BUFFER_SIZE    4UL
#define EFI_BUFFER_TOO_SMALL   5UL
#define EFI_NOT_FOUND          14UL
#define EFI_DEVICE_ERROR       7UL
#define EFI_OUT_OF_RESOURCES   9UL
#define EFI_ACCESS_DENIED      15UL
#define EFI_ABORTED            21UL

#define EFI_ERROR(x)  (((x) & ~(UINTN)0x1F) != 0)

#define NULL ((void *)0)

typedef struct {
  UINT32 Data1;
  UINT16 Data2;
  UINT16 Data3;
  UINT8  Data4[8];
} EFI_GUID;

typedef struct {
  UINT64 Signature;
  UINT32 Revision;
  UINT32 HeaderSize;
  UINT32 CRC32;
  UINT32 Reserved;
} EFI_TABLE_HEADER;

struct EFI_SIMPLE_TEXT_OUTPUT_PROTOCOL;

typedef struct {
  UINT64                            Signature;
  UINT32                            Revision;
  UINT32                            HeaderSize;
  UINT32                            CRC32;
  UINT32                            Reserved;
  /* (the rest of the console-in protocol is unused by us) */
} EFI_SIMPLE_TEXT_INPUT_PROTOCOL_HEAD;

typedef EFI_STATUS (*EFI_TEXT_RESET)(struct EFI_SIMPLE_TEXT_OUTPUT_PROTOCOL *self, BOOLEAN extended);
typedef EFI_STATUS (*EFI_TEXT_STRING)(struct EFI_SIMPLE_TEXT_OUTPUT_PROTOCOL *self, CHAR16 *string);
typedef EFI_STATUS (*EFI_TEXT_CLEAR)(struct EFI_SIMPLE_TEXT_OUTPUT_PROTOCOL *self);
typedef EFI_STATUS (*EFI_TEXT_ENABLE_CURSOR)(struct EFI_SIMPLE_TEXT_OUTPUT_PROTOCOL *self, BOOLEAN visible);

struct EFI_SIMPLE_TEXT_OUTPUT_PROTOCOL {
  EFI_TEXT_RESET          Reset;
  EFI_TEXT_STRING         OutputString;
  void                   *TestString;
  void                   *QueryMode;
  void                   *SetMode;
  void                   *SetAttribute;
  EFI_TEXT_CLEAR          ClearScreen;
  void                   *SetCursorPosition;
  EFI_TEXT_ENABLE_CURSOR  EnableCursor;
  void                   *Mode;
};

struct EFI_BOOT_SERVICES;
typedef struct EFI_BOOT_SERVICES EFI_BOOT_SERVICES;

struct EFI_RUNTIME_SERVICES;
typedef struct EFI_RUNTIME_SERVICES EFI_RUNTIME_SERVICES;

typedef struct {
  EFI_TABLE_HEADER Hdr;
  CHAR16          *FirmwareVendor;
  UINT32           FirmwareRevision;
  EFI_HANDLE       ConsoleInHandle;
  void            *ConIn;
  EFI_HANDLE       ConsoleOutHandle;
  struct EFI_SIMPLE_TEXT_OUTPUT_PROTOCOL *ConOut;
  EFI_HANDLE       StandardErrorHandle;
  struct EFI_SIMPLE_TEXT_OUTPUT_PROTOCOL *StdErr;
  struct EFI_RUNTIME_SERVICES *RuntimeServices;
  struct EFI_BOOT_SERVICES    *BootServices;
  UINTN            NumberOfTableEntries;
  void            *ConfigurationTable;
} EFI_SYSTEM_TABLE;

/* enough of EFI_BOOT_SERVICES to reach HandleProtocol() */
struct EFI_BOOT_SERVICES {
  EFI_TABLE_HEADER Hdr;
  void *RaiseTPL;
  void *RestoreTPL;
  EFI_STATUS (*AllocatePages)(UINTN type, UINTN mem_type, UINTN pages, EFI_PHYSICAL_ADDRESS *memory);
  EFI_STATUS (*FreePages)(EFI_PHYSICAL_ADDRESS memory, UINTN pages);
  void *GetMemoryMap;
  EFI_STATUS (*AllocatePool)(UINTN pool_type, UINTN size, void **buffer);
  EFI_STATUS (*FreePool)(void *buffer);
  void *CreateEvent;
  void *SetTimer;
  void *WaitForEvent;
  void *SignalEvent;
  void *CloseEvent;
  void *CheckEvent;
  void *InstallProtocolInterface;
  void *ReinstallProtocolInterface;
  void *UninstallProtocolInterface;
  EFI_STATUS (*HandleProtocol)(EFI_HANDLE handle, EFI_GUID *protocol, void **interface);
  void *Reserved;
  void *RegisterProtocolNotify;
  void *LocateHandle;
  void *LocateDevicePath;
  void *InstallConfigurationTable;
  void *LoadImage;
  void *StartImage;
  void *Exit;
  void *UnloadImage;
  EFI_STATUS (*ExitBootServices)(EFI_HANDLE image_handle, UINTN map_key);
  void *GetNextMonotonicCount;
  void *Stall;
  void *SetWatchdogTimer;
  void *ConnectController;
  void *DisconnectController;
  void *OpenProtocol;
  void *CloseProtocol;
  void *OpenProtocolInformation;
  void *ProtocolsPerHandle;
  EFI_STATUS (*LocateHandleBuffer)(UINTN search_type, EFI_GUID *protocol,
                                   void *search_key, UINTN *no_handles,
                                   EFI_HANDLE **buffer);
  void *LocateProtocol;
};

#define EFI_LOCATE_BY_PROTOCOL 2

#define AllocateAnyPages        0
#define AllocateMaxAddress      1
#define AllocateAddress         2

#define EfiLoaderData           2
#define EfiConventionalMemory   7

/* ---------------------------------------------------------------- protocols */
typedef struct {
  UINT32 Revision;
  EFI_HANDLE ParentHandle;
  EFI_SYSTEM_TABLE *SystemTable;
  EFI_HANDLE DeviceHandle;
  void *FilePath;
  void *Reserved;
  UINT32 LoadOptionsSize;
  void *LoadOptions;
  void *ImageBase;
  UINT64 ImageSize;
  UINTN ImageCodeType;
  UINTN ImageDataType;
  void *Unload;
} EFI_LOADED_IMAGE_PROTOCOL;

typedef struct EFI_FILE_PROTOCOL EFI_FILE_PROTOCOL;
struct EFI_FILE_PROTOCOL {
  UINT64 Revision;
  EFI_STATUS (*Open)(EFI_FILE_PROTOCOL *self, EFI_FILE_PROTOCOL **new_handle,
                     CHAR16 *file_name, UINT64 open_mode, UINT64 attributes);
  EFI_STATUS (*Close)(EFI_FILE_PROTOCOL *self);
  void *Delete;
  EFI_STATUS (*Read)(EFI_FILE_PROTOCOL *self, UINTN *buffer_size, void *buffer);
  void *Write;
  void *GetPosition;
  EFI_STATUS (*SetPosition)(EFI_FILE_PROTOCOL *self, UINT64 position);
  void *GetInfo;
  void *SetInfo;
  void *Flush;
};

typedef struct {
  UINT64 Revision;
  EFI_STATUS (*OpenVolume)(void *self, EFI_FILE_PROTOCOL **root);
} EFI_SIMPLE_FILE_SYSTEM_PROTOCOL;

#define EFI_FILE_MODE_READ   0x0000000000000001ULL
#define EFI_FILE_MODE_WRITE  0x0000000000000002ULL
#define EFI_FILE_MODE_CREATE 0x8000000000000000ULL

static EFI_GUID thadd_loaded_image_guid = {
  0x5B1B31A1, 0x9562, 0x11d2, { 0x8E, 0x3F, 0x00, 0xA0, 0xC9, 0x69, 0x72, 0x3B }
};
static EFI_GUID thadd_sfsp_guid = {
  0x964E5B22, 0x6459, 0x11d2, { 0x8E, 0x39, 0x00, 0xA0, 0xC9, 0x69, 0x72, 0x3B }
};

#endif /* THADD_EFI_H */
