/**
 * @license
 * Copyright 2016 Google Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Basic typings for dojo package.
 */

declare module 'dojo_websocket' {

  import {EditorLayer} from 'neuroglancer/editor/layer';

  // Fulfills a promise for a websocket
  type fn = (msg: string) => void;

  // Wrapper for dojo websocket
  interface EditorSocket {
    // returns link state
    open: (resolve: fn, reject: fn) => void,
    // Takes an object to jsonify
    send: (resolve: fn, reject: fn, m: any) => void,
  }

  interface EditorSocketConstructor {
    new(editorLayer: EditorLayer): EditorSocket;
  }

  const EditorSocket: EditorSocketConstructor;
}
