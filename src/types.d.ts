declare module '*.html' {
  const content: string;
  export default content;
}

// Minimal three.js declarations for types used directly in our code.
// The full library is available at runtime via 3d-force-graph's dependency.
declare module 'three' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
  export class Object3D<E = any> {
    children: Object3D[];
    add(...object: Object3D[]): this;
    remove(...object: Object3D[]): this;
    [key: string]: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  }
  export class Group extends Object3D {}
  export class Sprite extends Object3D {}
}
