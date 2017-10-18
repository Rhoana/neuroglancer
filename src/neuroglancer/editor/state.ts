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

import {TrackableValue} from 'neuroglancer/trackable_value';
import {RefCounted} from 'neuroglancer/util/disposable';
import {Uint64} from 'neuroglancer/util/uint64';

/*
 * Names of all valid editors
 */
export const enum EDITORS {
  NONE = 0,
  MERGE = 0,
  SPLIT = 1,
  TOTAL = 2,
};

/*
 * Begin EditorState definition
 */
export function getValidEditor(editor: number): number {
  return editor % EDITORS.TOTAL;
}
export function trackableEditor(editor: number = EDITORS.NONE) {
  return new TrackableValue<number>(editor, getValidEditor);
}
export interface EditorState {
  editor: TrackableValue<number>;
  segment: Uint64 | undefined;
}
