import koffi from 'koffi';

// Only loaded after the CLI's platform check. The handle stays in the CLI;
// Windows terminates every member when this handle closes, even after a crash.
const kernel = koffi.load('kernel32.dll');
const basic = koffi.struct({
  PerProcessUserTimeLimit: 'int64_t', PerJobUserTimeLimit: 'int64_t',
  LimitFlags: 'uint32_t', MinimumWorkingSetSize: 'size_t', MaximumWorkingSetSize: 'size_t',
  ActiveProcessLimit: 'uint32_t', Affinity: 'uintptr_t', PriorityClass: 'uint32_t', SchedulingClass: 'uint32_t',
});
const io = koffi.struct({
  ReadOperationCount: 'uint64_t', WriteOperationCount: 'uint64_t', OtherOperationCount: 'uint64_t',
  ReadTransferCount: 'uint64_t', WriteTransferCount: 'uint64_t', OtherTransferCount: 'uint64_t',
});
const limits = koffi.struct({
  BasicLimitInformation: basic, IoInfo: io, ProcessMemoryLimit: 'size_t', JobMemoryLimit: 'size_t',
  PeakProcessMemoryUsed: 'size_t', PeakJobMemoryUsed: 'size_t',
});
const create = kernel.func('void* __stdcall CreateJobObjectW(void*, const char16_t*)');
const set = kernel.func('SetInformationJobObject', 'int', ['void*', 'int', koffi.pointer(limits), 'uint32_t']);
const open = kernel.func('void* __stdcall OpenProcess(uint32_t, int, uint32_t)');
const assign = kernel.func('int __stdcall AssignProcessToJobObject(void*, void*)');
const contains = kernel.func('int __stdcall IsProcessInJob(void*, void*, _Out_ int*)');
const close = kernel.func('int __stdcall CloseHandle(void*)');
const errorCode = kernel.func('uint32_t __stdcall GetLastError()');
const check = (ok, action) => {if (!ok) throw new Error(`${action}: Windows error ${errorCode()}`);};

export function createJob() {
  let handle = create(null, null);
  check(handle, 'CreateJobObject');
  try {
    check(set(handle, 9, {BasicLimitInformation: {LimitFlags: 0x2000}}, koffi.sizeof(limits)), 'SetInformationJobObject');
  } catch (error) {close(handle); throw error;}
  return {
    assign(pid) {
      const process = open(0x0101, 0, pid); // SET_QUOTA | TERMINATE
      check(process, 'OpenProcess for job assignment');
      try {check(assign(handle, process), 'AssignProcessToJobObject');} finally {close(process);}
    },
    owns(pid) {
      const process = open(0x1000, 0, pid); // QUERY_LIMITED_INFORMATION
      if (!process) return false;
      const result = [0];
      try {return Boolean(contains(process, handle, result) && result[0]);} finally {close(process);}
    },
    close() {
      if (!handle) return;
      check(close(handle), 'CloseHandle for job');
      handle = null;
    },
  };
}
