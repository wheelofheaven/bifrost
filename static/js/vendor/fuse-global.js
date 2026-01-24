// Expose Fuse globally after UMD module loads
// Required because esbuild's IIFE wrapper changes 'this' context
if (typeof window !== 'undefined') {
  window.Fuse = window.Fuse || self.Fuse || (typeof Fuse !== 'undefined' ? Fuse : null);
}
