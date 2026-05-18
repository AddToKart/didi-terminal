use std::sync::OnceLock;

#[cfg(windows)]
use windows::Win32::Foundation::HANDLE;
#[cfg(windows)]
use windows::Win32::System::JobObjects::{
    AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
    SetInformationJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
    JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
};

#[cfg(windows)]
static JOB_HANDLE: OnceLock<isize> = OnceLock::new();

#[cfg(windows)]
pub fn init_job_object() {
    unsafe {
        let handle = CreateJobObjectW(None, None).expect("Failed to create job object");
        
        let mut info = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
        info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        
        SetInformationJobObject(
            handle,
            JobObjectExtendedLimitInformation,
            &info as *const _ as *const std::ffi::c_void,
            std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
        ).expect("Failed to set job object information");
        
        let _ = JOB_HANDLE.set(handle.0 as isize);
    }
}

#[cfg(windows)]
pub fn assign_process_to_job(pid: u32) {
    if let Some(val) = JOB_HANDLE.get() {
        let handle = HANDLE(*val as *mut core::ffi::c_void);
        use windows::Win32::System::Threading::{OpenProcess, PROCESS_SET_QUOTA, PROCESS_TERMINATE};
        unsafe {
            if let Ok(process_handle) = OpenProcess(PROCESS_SET_QUOTA | PROCESS_TERMINATE, false, pid) {
                let _ = AssignProcessToJobObject(handle, process_handle);
                let _ = windows::Win32::Foundation::CloseHandle(process_handle);
            }
        }
    }
}

#[cfg(not(windows))]
pub fn init_job_object() {}

#[cfg(not(windows))]
pub fn assign_process_to_job(_pid: u32) {}

