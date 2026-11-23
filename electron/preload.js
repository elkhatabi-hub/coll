const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getSchoolYears: () => ipcRenderer.invoke('db:get-school-years'),
  setActiveSchoolYear: (yearId) => ipcRenderer.invoke('db:set-active-school-year', yearId),
  createSchoolYear: (payload) => ipcRenderer.invoke('db:create-school-year', payload),
  getYearData: (yearId) => ipcRenderer.invoke('db:get-year-data', yearId),

  getSettings: () => ipcRenderer.invoke('db:get-settings'),
  updateSettings: (data) => ipcRenderer.invoke('db:update-settings', data),
  uploadLogo: () => ipcRenderer.invoke('upload-logo'),

  importStudentsExcel: (payload) => ipcRenderer.invoke('import:students', payload),
  importGuardiansExcel: (payload) => ipcRenderer.invoke('import:guardians', payload),
  importTeachersExcel: (payload) => ipcRenderer.invoke('import:teachers', payload),
  importScheduleExcel: (payload) => ipcRenderer.invoke('import:schedule', payload),
  importMovementsExcel: (payload) => ipcRenderer.invoke('import:movements', payload),

  createBackup: () => ipcRenderer.invoke('create-backup'),
  restoreBackup: () => ipcRenderer.invoke('restore-backup'),

  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
  installUpdateNow: () => ipcRenderer.invoke('updater:install-now'),
  onUpdaterStatus: (callback) => {
    const listener = (_, payload) => callback(payload);
    ipcRenderer.on('updater:status', listener);
    return () => ipcRenderer.removeListener('updater:status', listener);
  }
});
