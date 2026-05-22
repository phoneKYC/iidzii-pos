// Type declarations for optional Capacitor modules (used with dynamic imports + try/catch)
declare module '@capacitor/app' {
  export const App: {
    exitApp: () => Promise<void>;
    addListener: (event: string, callback: () => void) => Promise<{ remove: () => void }>;
  };
}
declare module '@capacitor/filesystem' {
  export const Filesystem: {
    writeFile: (opts: any) => Promise<any>;
    getUri: (opts: any) => Promise<{ uri: string }>;
  };
  export const Encoding: { UTF8: string };
}
declare module '@capacitor/share' {
  export const Share: {
    share: (opts: any) => Promise<any>;
  };
}
declare module '@capacitor/camera' {
  export const Camera: {
    getPhoto: (opts: any) => Promise<any>;
    requestPermissions: (opts: any) => Promise<any>;
  };
  export const CameraResultType: { DataUrl: string; Uri: string };
  export const CameraSource: { Camera: string; Photos: string };
}
declare module '@capacitor/browser' {
  export const Browser: {
    open: (opts: any) => Promise<any>;
  };
}
