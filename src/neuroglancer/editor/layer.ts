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
import {UserLayer} from 'neuroglancer/layer';
import {EditorState} from 'neuroglancer/editor/state';
import {EditorSource} from 'neuroglancer/editor/source';
import {EditorSocket} from 'dojo_websocket';

/*
 * Begin EditorLayer definition
 */
export interface EditorLayer extends UserLayer {
  handleEditorAction: (action: string, editorState: EditorState) => void;
  editorSocket: EditorSocket;
  editorSource: EditorSource;
}

// Check if follows interface
export function isEditorLayer(layer: any): layer is EditorLayer {
  return (<EditorLayer>layer).handleEditorAction !== undefined;
}

// Convert user layer to editor layer
export function toEditorLayer(layer: any): EditorLayer | undefined {
  if (isEditorLayer(layer)) {
    return layer;
  }
  return undefined;
}
