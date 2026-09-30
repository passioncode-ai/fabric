// Vite's own client types, which is where the `?worker` suffix is declared.
// It must live in a file with no imports or exports: an ambient declaration
// inside a module file is read as augmentation and fails to resolve.
/// <reference types="vite/client" />
