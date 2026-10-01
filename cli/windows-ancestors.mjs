import koffi from 'koffi';

// The caller holds the preview session, but launchers such as npx put several
// processes between it and this CLI, and hosts that stop a task may terminate
// only the outermost one. Hold a handle to every live ancestor: a handle keeps
// observing that exact process even after Windows reuses its PID.
const kernel = koffi.load('kernel32.dll');
const entry = koffi.struct('PROCESSENTRY32W', {
  dwSize: 'uint32_t', cntUsage: 'uint32_t', th32ProcessID: 'uint32_t', th32DefaultHeapID: 'uintptr_t',
  th32ModuleID: 'uint32_t', cntThreads: 'uint32_t', th32ParentProcessID: 'uint32_t', pcPriClassBase: 'int32_t',
  dwFlags: 'uint32_t', szExeFile: koffi.array('char16_t', 260),
});
const snapshot = kernel.func('void* __stdcall CreateToolhelp32Snapshot(uint32_t, uint32_t)');
const first = kernel.func('int __stdcall Process32FirstW(void*, _Inout_ PROCESSENTRY32W*)');
const next = kernel.func('int __stdcall Process32NextW(void*, _Inout_ PROCESSENTRY32W*)');
const open = kernel.func('void* __stdcall OpenProcess(uint32_t, int, uint32_t)');
const times = kernel.func('int __stdcall GetProcessTimes(void*, _Out_ uint64_t*, _Out_ uint64_t*, _Out_ uint64_t*, _Out_ uint64_t*)');
const wait = kernel.func('uint32_t __stdcall WaitForSingleObject(void*, uint32_t)');
const close = kernel.func('int __stdcall CloseHandle(void*)');

function parents() {
  const handle = snapshot(0x2, 0); // TH32CS_SNAPPROCESS
  if (!handle || koffi.address(handle) === 0xFFFFFFFFFFFFFFFFn) throw new Error('CreateToolhelp32Snapshot failed');
  const map = new Map();
  try {
    const item = {dwSize: koffi.sizeof(entry)};
    for (let ok = first(handle, item); ok; ok = next(handle, item)) map.set(item.th32ProcessID, item.th32ParentProcessID);
  } finally {close(handle);}
  return map;
}

function created(handle) {
  const value = [0];
  if (!times(handle, value, [0], [0], [0])) throw new Error('GetProcessTimes failed');
  return BigInt(value[0]);
}

export function watchAncestors() {
  const map = parents();
  const handles = [];
  const self = open(0x1000, 0, process.pid); // QUERY_LIMITED_INFORMATION
  let younger;
  try {younger = created(self);} finally {close(self);}
  for (let pid = map.get(process.pid), seen = new Set(); map.has(pid) && !seen.has(pid); pid = map.get(pid)) {
    seen.add(pid);
    const handle = open(0x00101000, 0, pid); // SYNCHRONIZE | QUERY_LIMITED_INFORMATION
    if (!handle) break; // Protected or already gone: nothing above it can be observed reliably.
    const birth = created(handle);
    // A parent created after its child is a reused PID; one already signalled exited before
    // this session began (an open handle elsewhere can keep its process object alive).
    if (birth > younger || wait(handle, 0) === 0) {close(handle); break;}
    handles.push(handle);
    younger = birth;
  }
  return {
    exited: () => handles.some(handle => wait(handle, 0) === 0), // WAIT_OBJECT_0
    close() {handles.splice(0).forEach(handle => close(handle));},
  };
}
