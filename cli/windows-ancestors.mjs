import koffi from 'koffi';

// The caller holds the preview session, but launchers such as cmd shims or node
// wrappers can sit between it and this CLI, and a host may terminate only the
// outermost one. Hold a handle to every live ancestor: a handle keeps observing
// that exact process even after Windows reuses its PID. Shells that emulate
// fork (Git Bash) break the Windows parent chain; nothing above the break is seen.
const kernel = koffi.load('kernel32.dll');
const entry = koffi.struct('PROCESSENTRY32W', {
  dwSize: 'uint32_t', cntUsage: 'uint32_t', th32ProcessID: 'uint32_t', th32DefaultHeapID: 'uintptr_t',
  th32ModuleID: 'uint32_t', cntThreads: 'uint32_t', th32ParentProcessID: 'uint32_t', pcPriClassBase: 'int32_t',
  dwFlags: 'uint32_t', szExeFile: koffi.array('char16_t', 260),
});
const snapshot = kernel.func('void* __stdcall CreateToolhelp32Snapshot(uint32_t, uint32_t)');
const first = kernel.func('int __stdcall Process32FirstW(void*, _Inout_ PROCESSENTRY32W*)');
const next = kernel.func('int __stdcall Process32NextW(void*, _Inout_ PROCESSENTRY32W*)');
const current = kernel.func('void* __stdcall GetCurrentProcess()');
const open = kernel.func('void* __stdcall OpenProcess(uint32_t, int, uint32_t)');
const times = kernel.func('int __stdcall GetProcessTimes(void*, _Out_ uint64_t*, _Out_ uint64_t*, _Out_ uint64_t*, _Out_ uint64_t*)');
const wait = kernel.func('uint32_t __stdcall WaitForSingleObject(void*, uint32_t)');
const close = kernel.func('int __stdcall CloseHandle(void*)');
const errorCode = kernel.func('uint32_t __stdcall GetLastError()');

function processes() {
  const handle = snapshot(0x2, 0); // TH32CS_SNAPPROCESS
  if (!handle || koffi.address(handle) === 0xFFFFFFFFFFFFFFFFn) throw new Error(`CreateToolhelp32Snapshot: Windows error ${errorCode()}`);
  const map = new Map();
  try {
    const item = {dwSize: koffi.sizeof(entry)};
    for (let ok = first(handle, item); ok; ok = next(handle, item)) map.set(item.th32ProcessID, {parent: item.th32ParentProcessID, name: item.szExeFile});
  } finally {close(handle);}
  return map;
}

function created(handle) {
  const value = [0];
  if (!times(handle, value, [0], [0], [0])) throw new Error(`GetProcessTimes: Windows error ${errorCode()}`);
  return BigInt(value[0]);
}

export function watchAncestors() {
  const map = processes();
  const watched = [];
  let younger = created(current());
  for (let pid = map.get(process.pid)?.parent, seen = new Set(); map.has(pid) && !seen.has(pid); pid = map.get(pid).parent) {
    seen.add(pid);
    const {name} = map.get(pid);
    // The desktop shell outlives every session; restarting it should not stop previews.
    if (name.toLowerCase() === 'explorer.exe') break;
    const handle = open(0x00101000, 0, pid); // SYNCHRONIZE | QUERY_LIMITED_INFORMATION
    if (!handle) break; // Protected or already gone: nothing above it can be observed reliably.
    let birth;
    try {birth = created(handle);} catch {close(handle); break;}
    // A parent created after its child is a reused PID; one already signalled exited before
    // this session began (an open handle elsewhere can keep its process object alive).
    if (birth > younger || wait(handle, 0) === 0) {close(handle); break;}
    watched.push({pid, name, handle});
    younger = birth;
  }
  return {
    exited: () => watched.find(({handle}) => wait(handle, 0) === 0), // WAIT_OBJECT_0
    close() {watched.splice(0).forEach(({handle}) => close(handle));},
  };
}
